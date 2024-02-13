import {
  JSONRPCClient,
  JSONRPCErrorException,
  JSONRPCServer,
  JSONRPCServerAndClient,
} from "json-rpc-2.0";

import { log } from "../logging";
import { RedditProvider } from "../reddit/reddit-interaction-client";
import {
  ErrorCode,
  RedditCreateAddressOwnershipChallenge,
  RedditGetAccountVaultAddresses,
  RedditGetUserProfile,
  RedditGetUserVaultAddress,
  RedditRegisterAddressWithAccount,
} from "../reddit/reddit-interaction-spec";
import { createRCPMethodCaller } from "../rpc/typing";
import {
  bindPortToJSONRPCServerAndClient,
  createPortSendRequestFn,
} from "../rpc/webextension-port-json-rpc";
import {
  VaultonomyBackgroundEvent,
  VaultonomyGetRedditTabAvailability,
  VaultonomyUiNotify,
} from "../vaultonomy-rpc-spec";
import { retroactivePortDisconnection } from "../webextensions/retroactivePortDisconnection";

type Unbind = () => void;

/**
 * Client for the Vaultonomy UI service.
 *
 * Provides methods that make JSON RCPC calls to a Valtonomy UI service.
 */
class VaultonomyUiProvider {
  constructor(vaultonomyUiClient: JSONRPCClient) {
    this.notify = createRCPMethodCaller({
      method: VaultonomyUiNotify,
      client: vaultonomyUiClient,
    });
  }

  notify: (event: VaultonomyBackgroundEvent) => Promise<null>;
}

function redditDisconnectedError(
  methodName: string,
  params?: unknown,
): JSONRPCErrorException {
  return new JSONRPCErrorException(
    "No Reddit tab is connected, cannot forward request.",
    ErrorCode.REDDIT_TAB_DISCONNECTED,
    {
      method: methodName,
      params,
    },
  );
}

/**
 * The Background side of the Vaultonomy UI <-> Background RPC.
 *
 * This is connection oriented, a connection corresponds to a session. An
 * instance of this class implements the RPC methods for a single active
 * connection, single active session (we typically have either zero or one
 * connection active).
 */
export class VaultonomyBackgroundServiceSession {
  private disconnected: boolean = false;
  private redditProvider: RedditProvider | undefined;
  private readonly jsonrpc: JSONRPCServerAndClient;
  private readonly vaultonomyUi: VaultonomyUiProvider;
  private readonly unbindFromPort: Unbind;

  constructor(private readonly port: chrome.runtime.Port) {
    this.disconnected = retroactivePortDisconnection.hasDisconnected(port);
    retroactivePortDisconnection.addRetroactiveDisconnectListener(port, () => {
      this.disconnect();
    });
    this.jsonrpc = this.createServerAndClient(port);
    this.unbindFromPort = bindPortToJSONRPCServerAndClient({
      port,
      serverAndClient: this.jsonrpc,
    });
    this.vaultonomyUi = new VaultonomyUiProvider(this.jsonrpc.client);
  }

  private createServerAndClient(
    port: chrome.runtime.Port,
  ): JSONRPCServerAndClient {
    return new JSONRPCServerAndClient(
      this.createServer(),
      this.createClient(port),
    );
  }

  private createServer(): JSONRPCServer {
    const server = new JSONRPCServer({ errorListener: () => undefined });

    server.addMethod(
      VaultonomyGetRedditTabAvailability.name,
      VaultonomyGetRedditTabAvailability.signature.implement(async () => {
        return { available: this.redditProvider !== undefined };
      }),
    );

    // The UI needs to send requests to Reddit. We have the RedditProvider which
    // translates method calls into reddit_* JSON RPC requests.
    // src/reddit/reddit-interaction-server.ts implements an RPC server that
    // handles those methods by communicating with Reddit.
    //
    // The UI doesn't connect directly to the Reddit tab (because the dev server
    // page can't, even though the side-panel UI can), instead we have the UI
    // send reddit_* requests to this server, and we proxy them to the connected
    // reddit tab's server.

    server.addMethod(
      RedditGetUserProfile.name,
      RedditGetUserProfile.signature.implement(async (params) => {
        if (!this.redditProvider) {
          throw redditDisconnectedError(RedditGetUserProfile.name);
        }
        return await this.redditProvider.getUserProfile(params);
      }),
    );
    server.addMethod(
      RedditCreateAddressOwnershipChallenge.name,
      RedditCreateAddressOwnershipChallenge.signature.implement(
        async (params) => {
          if (!this.redditProvider) {
            throw redditDisconnectedError(
              RedditCreateAddressOwnershipChallenge.name,
              params,
            );
          }
          return await this.redditProvider.createAddressOwnershipChallenge(
            params,
          );
        },
      ),
    );
    server.addMethod(
      RedditRegisterAddressWithAccount.name,
      RedditRegisterAddressWithAccount.signature.implement(async (params) => {
        if (!this.redditProvider) {
          throw redditDisconnectedError(
            RedditRegisterAddressWithAccount.name,
            params,
          );
        }
        await this.redditProvider.registerAddressWithAccount(params);
        return null;
      }),
    );
    server.addMethod(
      RedditGetUserVaultAddress.name,
      RedditGetUserVaultAddress.signature.implement(async (params) => {
        if (!this.redditProvider) {
          throw redditDisconnectedError(RedditGetUserVaultAddress.name, params);
        }
        return await this.redditProvider.getUserVaultAddress(params);
      }),
    );
    server.addMethod(
      RedditGetAccountVaultAddresses.name,
      RedditGetAccountVaultAddresses.signature.implement(async (params) => {
        if (!this.redditProvider) {
          throw redditDisconnectedError(RedditGetAccountVaultAddresses.name);
        }
        return await this.redditProvider.getAccountVaultAddresses(params);
      }),
    );

    return server;
  }

  private createClient(port: chrome.runtime.Port): JSONRPCClient {
    const client = new JSONRPCClient(createPortSendRequestFn(port));
    return client;
  }

  setRedditProvider(redditProvider: RedditProvider | undefined): void {
    if (this.redditProvider === redditProvider) return;

    let event: VaultonomyBackgroundEvent | undefined;
    if (redditProvider && this.redditProvider === undefined) {
      event = { type: "redditTabBecameAvailable" };
    } else if (!redditProvider && this.redditProvider) {
      event = { type: "redditTabBecameUnavailable" };
    }
    this.disconnectRedditProvider();
    this.redditProvider = redditProvider;
    if (event) {
      this.vaultonomyUi
        .notify(event)
        .catch((error) =>
          this.#logErrorUnlessDisconnected("failed to notify UI", error),
        );
    }

    // We don't listen for the RedditProvider disconnecting, because that should
    // happen when its Reddit tab disconnects and we expect an external entity
    // is responsible for noticing that and calling setRedditProvider(undefined)
  }

  private disconnectRedditProvider(): void {
    // This also disconnects the provider's connection to its Reddit tab
    this.redditProvider?.emitter.emit("disconnectSelf");
  }

  #logErrorUnlessDisconnected(msg: string, error: unknown): void {
    if (!this.disconnected) {
      log.error(msg, error);
    }
  }

  /**
   * Close this session's UI Port and Reddit Port (if any).
   */
  disconnect(): void {
    this.disconnected = true;
    this.unbindFromPort();
    this.port.disconnect();
    this.disconnectRedditProvider();
  }
}
