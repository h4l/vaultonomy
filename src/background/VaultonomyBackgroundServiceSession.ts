import {
  JSONRPCClient,
  JSONRPCErrorException,
  JSONRPCErrorResponse,
  JSONRPCID,
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
  RedditGetUserVault,
  RedditRegisterAddressWithAccount,
} from "../reddit/reddit-interaction-spec";
import { CouldNotConnect } from "../rpc/connections";
import { createRCPMethodCaller } from "../rpc/typing";
import {
  bindPortToJSONRPCServerAndClient,
  createPortSendRequestFn,
} from "../rpc/webextension-port-json-rpc";
import { hasGlobalRedditTabScriptingPermission } from "../settings/PermissionsSettings";
import { VaultonomyUserPreferencesStore } from "../settings/VaultonomySettings";
import {
  TaggedVaultonomyBackgroundEvent,
  VaultonomyBackgroundEvent,
  VaultonomyGetRedditTabAvailability,
  VaultonomyGetSettings,
  VaultonomyGetUiNotifications,
  VaultonomyUiNotify,
} from "../vaultonomy-rpc-spec";
import { retroactivePortDisconnection } from "../webextensions/retroactivePortDisconnection";
import { RedditTabObserver } from "./RedditTabObserver";

type Unbind = () => void;

/**
 * Client for the Vaultonomy UI service.
 *
 * Provides methods that make JSON RPC calls to a Vaultonomy UI service.
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

function redditNotConnectedError(): JSONRPCErrorException {
  return new JSONRPCErrorException(
    "No Reddit tab is connected, cannot forward request.",
    ErrorCode.REDDIT_TAB_NOT_CONNECTED,
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
  private readonly port: chrome.runtime.Port;
  private readonly redditProvider: RedditProvider;
  private readonly redditTabObserver: RedditTabObserver;
  private disconnected: boolean = false;
  private readonly jsonrpc: JSONRPCServerAndClient;
  private readonly vaultonomyUi: VaultonomyUiProvider;
  private readonly unbindFromPort: Unbind;
  private readonly unbindAvailabilityChanged: Unbind;
  private readonly eventLog: ReadonlyArray<TaggedVaultonomyBackgroundEvent>;
  private readonly userPrefsStore: VaultonomyUserPreferencesStore;

  constructor({
    port,
    ...options
  }: {
    port: chrome.runtime.Port;
    redditProvider: RedditProvider;
    redditTabObserver: RedditTabObserver;
    eventLog: ReadonlyArray<TaggedVaultonomyBackgroundEvent>;
    userPrefsStore: VaultonomyUserPreferencesStore;
  }) {
    this.port = port;
    this.redditProvider = options.redditProvider;
    this.redditTabObserver = options.redditTabObserver;
    this.eventLog = options.eventLog;
    this.userPrefsStore = options.userPrefsStore;

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

    this.unbindAvailabilityChanged = this.redditTabObserver.emitter.on(
      "availabilityChanged",
      (availability) => {
        this.vaultonomyUi
          .notify({
            type:
              availability === "available" ?
                "redditTabBecameAvailable"
              : "redditTabBecameUnavailable",
          })
          .catch((error) =>
            this.#logErrorUnlessDisconnected("failed to notify UI", error),
          );
      },
    );
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

    const defaultMapError = server.mapErrorToJSONRPCErrorResponse;
    server.mapErrorToJSONRPCErrorResponse = (
      id: JSONRPCID,
      _error: any,
    ): JSONRPCErrorResponse => {
      const error = _error as Partial<Error>;
      // When proxying calls with RedditProvider, its errors wrap a JSONRPCErrorException
      // as error.cause. We should report this underlying error to transparently
      // proxy the error.
      if (
        !(error instanceof JSONRPCErrorException) &&
        error.cause instanceof JSONRPCErrorException
      ) {
        return defaultMapError(id, error.cause);
      }

      // RedditProvider creates Port connections to a Reddit tab as needed. This
      // can fail (throwing CouldNotConnect) if no Reddit tabs are available.
      if (error instanceof CouldNotConnect) {
        return defaultMapError(id, redditNotConnectedError());
      }

      return defaultMapError(id, error);
    };

    server.addMethod(
      VaultonomyGetRedditTabAvailability.name,
      VaultonomyGetRedditTabAvailability.signature.implement(async () => {
        return {
          available:
            (await this.redditTabObserver.availability) === "available",
        };
      }),
    );

    server.addMethod(
      VaultonomyGetUiNotifications.name,
      VaultonomyGetUiNotifications.signature.implement(async () => {
        return [...this.eventLog];
      }),
    );

    server.addMethod(
      VaultonomyGetSettings.name,
      VaultonomyGetSettings.signature.implement(async () => {
        const [preferences, hasGlobalScripting] = await Promise.all([
          this.userPrefsStore.getProperties(),
          hasGlobalRedditTabScriptingPermission(),
        ]);

        return {
          preferences,
          permissions: {
            redditTabAccess: hasGlobalScripting ? "all" : "activeTab",
          },
        };
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
        return await this.redditProvider.getUserProfile(params);
      }),
    );
    server.addMethod(
      RedditCreateAddressOwnershipChallenge.name,
      RedditCreateAddressOwnershipChallenge.signature.implement(
        async (params) => {
          return await this.redditProvider.createAddressOwnershipChallenge(
            params,
          );
        },
      ),
    );
    server.addMethod(
      RedditRegisterAddressWithAccount.name,
      RedditRegisterAddressWithAccount.signature.implement(async (params) => {
        await this.redditProvider.registerAddressWithAccount(params);
        return null;
      }),
    );
    server.addMethod(
      RedditGetUserVault.name,
      RedditGetUserVault.signature.implement(async (params) => {
        return await this.redditProvider.getUserVault(params);
      }),
    );
    server.addMethod(
      RedditGetAccountVaultAddresses.name,
      RedditGetAccountVaultAddresses.signature.implement(async (params) => {
        return await this.redditProvider.getAccountVaultAddresses(params);
      }),
    );

    return server;
  }

  private createClient(port: chrome.runtime.Port): JSONRPCClient {
    const client = new JSONRPCClient(createPortSendRequestFn(port));
    return client;
  }

  #logErrorUnlessDisconnected(msg: string, error: unknown): void {
    if (!this.disconnected) {
      log.error(msg, error);
    }
  }

  async notifyInterestInUser(
    event: TaggedVaultonomyBackgroundEvent,
  ): Promise<void> {
    await this.vaultonomyUi.notify(event);
  }

  /**
   * Close this session's UI Port and Reddit Port (if any).
   */
  disconnect(): void {
    this.disconnected = true;
    this.unbindFromPort();
    this.port.disconnect();
    this.unbindAvailabilityChanged();
    this.redditProvider.disconnect();
  }
}
