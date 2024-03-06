import { JSONRPCClient, JSONRPCErrorException } from "json-rpc-2.0";
import { Emitter, createNanoEvents } from "nanoevents";

import { VaultonomyError } from "../VaultonomyError";
import {
  Connector,
  Disconnect,
  ManagedConnection,
  ReconnectingManagedConnection,
} from "../rpc/connections";
import { createRCPMethodCaller } from "../rpc/typing";
import { createJSONRPCClientPortConnector } from "../rpc/webextension-port-json-rpc";
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
  RedditGetOtherUserProfileParams,
  RedditGetOwnUserProfileParams,
  RedditGetUserProfile,
  RedditGetUserProfileParams,
  RedditGetUserVault,
  RedditGetUserVaultParams,
  RedditRegisterAddressWithAccount,
  RedditRegisterAddressWithAccountParams,
  RedditUserProfile,
  isErrorCode,
} from "./reddit-interaction-spec";
import { AnyRedditUserProfile } from "./types";

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
   * from the Port.
   */
  public static from(portConnector: Connector<chrome.runtime.Port>) {
    return new RedditProvider(
      new ReconnectingManagedConnection(
        createJSONRPCClientPortConnector({ portConnector }),
      ),
    );
  }

  readonly emitter: Emitter<RedditProviderEvents> = createNanoEvents();
  private _mostRecentError: AnyRedditProviderError | undefined;
  private readonly managedClient: ManagedConnection<JSONRPCClient>;
  private readonly unbindManagedClientEvents: Disconnect;

  constructor(managedClient: ManagedConnection<JSONRPCClient>) {
    this.managedClient = managedClient;
    this.unbindManagedClientEvents = this.managedClient.emitter.on(
      "disconnected",
      () => this.emitter.emit("disconnected"),
    );

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
        managedClient,
        mapError: AnyRedditProviderError.from,
      }),
    );
    this.createAddressOwnershipChallenge = trackErrors(
      createRCPMethodCaller({
        method: RedditCreateAddressOwnershipChallenge,
        managedClient,
        mapError: AnyRedditProviderError.from,
      }),
    );
    this.registerAddressWithAccount = trackErrors(
      createRCPMethodCaller({
        method: RedditRegisterAddressWithAccount,
        managedClient,
        mapError: AnyRedditProviderError.from,
      }),
    );
    this.getUserVault = trackErrors(
      createRCPMethodCaller({
        method: RedditGetUserVault,
        managedClient,
        mapError: AnyRedditProviderError.from,
      }),
    );
    this.getAccountVaultAddresses = trackErrors(
      createRCPMethodCaller({
        method: RedditGetAccountVaultAddresses,
        managedClient,
        mapError: AnyRedditProviderError.from,
      }),
    );
  }

  disconnect(): void {
    // Note: with ReconnectingManagedConnection the managedClient can re-connect
    // after we disconnect() it if another provider call is made.
    // TODO: should we shut down the provider to prevent subsequent calls?
    this.managedClient.disconnect();
    this.unbindManagedClientEvents();
  }

  // This is required because params is optional with default null, but
  // createRCPMethodCaller doesn't support null default args.
  private _getUserProfile: (
    params: RedditGetUserProfileParams | null,
  ) => Promise<AnyRedditUserProfile>;

  // TODO: should we make these return functional error values rather than throw?

  getUserProfile(): Promise<RedditUserProfile>;
  getUserProfile(
    params: RedditGetOwnUserProfileParams | null,
  ): Promise<RedditUserProfile>;
  getUserProfile(
    params: RedditGetOtherUserProfileParams,
  ): Promise<AnyRedditUserProfile>;

  // This overload is covered by the others, but is needed to satisfy TS when a
  // params var is a union of the other overloads' argument types.
  getUserProfile(
    params?: RedditGetUserProfileParams | null,
  ): Promise<AnyRedditUserProfile>;

  getUserProfile(
    params: RedditGetUserProfileParams | null = null,
  ): Promise<AnyRedditUserProfile> {
    // TODO: assert to enforce overload types
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
