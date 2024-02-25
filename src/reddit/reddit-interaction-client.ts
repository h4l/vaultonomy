import { JSONRPCClient, JSONRPCErrorException } from "json-rpc-2.0";
import { Emitter, createNanoEvents } from "nanoevents";
import { Address } from "viem";

import { VaultonomyError } from "../VaultonomyError";
import { createRCPMethodCaller } from "../rpc/typing";
import {
  bindPortToJSONRPCClient,
  createPortSendRequestFn,
} from "../rpc/webextension-port-json-rpc";
import { retroactivePortDisconnection } from "../webextensions/retroactivePortDisconnection";
import {
  AccountVaultAddress,
  RedditEIP712Challenge,
  RedditUserVault,
} from "./api-client";
import {
  ErrorCode,
  RedditCreateAddressOwnershipChallenge,
  RedditCreateAddressOwnershipChallengeParams,
  RedditGetAccountVaultAddresses,
  RedditGetAccountVaultAddressesParams,
  RedditGetUserProfile,
  RedditGetUserProfileParams,
  RedditGetUserVault,
  RedditGetUserVaultParams,
  RedditRegisterAddressWithAccount,
  RedditRegisterAddressWithAccountParams,
  RedditUserProfile,
  isErrorCode,
} from "./reddit-interaction-spec";

export { AccountVaultAddress, RedditEIP712Challenge } from "./api-client";

export type EmptyCallback = () => void;
export interface RedditProviderEvents {
  /** Fired when the other end disconnects from us. */
  disconnected: EmptyCallback;
  /** Fired to disconnect ourself from the other end. */
  disconnectSelf: EmptyCallback;

  requestFailed: (error: AnyRedditProviderError) => void;
  requestSucceeded: () => void;
}

export abstract class AnyRedditProviderError extends VaultonomyError {
  abstract type: ErrorCode | null;
  constructor(options: ErrorOptions & { message: string }) {
    super(options.message, { cause: options.cause });
  }

  static from(error: JSONRPCErrorException): AnyRedditProviderError {
    if (isErrorCode(error.code)) {
      return new RedditProviderError({
        type: error.code,
        message: error.message,
        cause: error,
      });
    }
    return new UnknownRedditProviderError({
      message: error.message,
      cause: error,
    });
  }
}

export class RedditProviderError extends AnyRedditProviderError {
  type: ErrorCode;
  constructor(options: ErrorOptions & { type: ErrorCode; message: string }) {
    super(options);
    this.type = options.type;
  }
}

export class UnknownRedditProviderError extends AnyRedditProviderError {
  type: null = null;
}

/** An client interface to the reddit-interaction service.
 *
 * Disconnect the provider from its transport by emitting `disconnectSelf`:
 *
 * ```typescript
 * provider.emitter.emit("disconnectSelf");
 * ```
 */
export class RedditProvider {
  /** Create a RedditProvider that communicates over a WebExtension Port.
   *
   * The Port itself is also disconnected when this provider disconnects itself
   * from the Port, unless `options.propagateDisconnect` is `false`.
   */
  public static from(
    port: chrome.runtime.Port,
    options?: { propagateDisconnect?: boolean },
  ) {
    const client = new JSONRPCClient(createPortSendRequestFn(port));
    const rp = new RedditProvider({ redditInteractionClient: client });
    const unbind = bindPortToJSONRPCClient({ port, client });
    // propagate disconnection between the provider and the port both ways
    rp.emitter.on("disconnectSelf", () => {
      unbind();
      if (options?.propagateDisconnect !== false) {
        port.disconnect();
      }
    });
    retroactivePortDisconnection.addRetroactiveDisconnectListener(port, () => {
      rp.emitter.emit("disconnected");
    });
    return rp;
  }

  readonly emitter: Emitter<RedditProviderEvents> = createNanoEvents();
  private _mostRecentError: AnyRedditProviderError | undefined;

  constructor(options: { redditInteractionClient: JSONRPCClient }) {
    const client = options.redditInteractionClient;

    const trackErrors = <A extends any[], R>(
      f: (...args: A) => Promise<R>,
    ): ((...args: A) => Promise<R>) => {
      return async (...args) => {
        try {
          const response = await f(...args);
          this.emitter.emit("requestSucceeded");
          return response;
        } catch (e) {
          if (e instanceof AnyRedditProviderError) {
            this._mostRecentError = e;
            this.emitter.emit("requestFailed", e);
          }
          throw e;
        }
      };
    };

    this._getUserProfile = trackErrors(
      createRCPMethodCaller({
        method: RedditGetUserProfile,
        client,
        mapError: AnyRedditProviderError.from,
      }),
    );
    this.createAddressOwnershipChallenge = trackErrors(
      createRCPMethodCaller({
        method: RedditCreateAddressOwnershipChallenge,
        client,
        mapError: AnyRedditProviderError.from,
      }),
    );
    this.registerAddressWithAccount = trackErrors(
      createRCPMethodCaller({
        method: RedditRegisterAddressWithAccount,
        client,
        mapError: AnyRedditProviderError.from,
      }),
    );
    this.getUserVault = trackErrors(
      createRCPMethodCaller({
        method: RedditGetUserVault,
        client,
        mapError: AnyRedditProviderError.from,
      }),
    );
    this.getAccountVaultAddresses = trackErrors(
      createRCPMethodCaller({
        method: RedditGetAccountVaultAddresses,
        client,
        mapError: AnyRedditProviderError.from,
      }),
    );
  }

  // This is required because params is optional with default null, but
  // createRCPMethodCaller doesn't support null default args.
  private _getUserProfile: (
    params: RedditGetUserProfileParams | null,
  ) => Promise<RedditUserProfile>;

  // TODO: should we make these return functional error values rather than throw?

  getUserProfile(
    params: RedditGetUserProfileParams | null = null,
  ): Promise<RedditUserProfile> {
    return this._getUserProfile(params);
  }
  createAddressOwnershipChallenge: (
    params: RedditCreateAddressOwnershipChallengeParams,
  ) => Promise<RedditEIP712Challenge>;
  registerAddressWithAccount: (
    params: RedditRegisterAddressWithAccountParams,
  ) => Promise<null>;
  getUserVault: (
    params: RedditGetUserVaultParams,
  ) => Promise<RedditUserVault | null>;
  getAccountVaultAddresses: (
    params: RedditGetAccountVaultAddressesParams,
  ) => Promise<Array<AccountVaultAddress>>;

  // TODO: do we actually need this?
  get mostRecentError(): AnyRedditProviderError | undefined {
    return this._mostRecentError;
  }
}
