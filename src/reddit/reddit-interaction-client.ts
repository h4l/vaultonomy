import { JSONRPCClient, JSONRPCErrorException } from "json-rpc-2.0";
import { Emitter, createNanoEvents } from "nanoevents";
import { Address } from "viem";

import { createRCPMethodCaller } from "../rpc/typing";
import {
  bindPortToJSONRPCClient,
  createPortSendRequestFn,
} from "../rpc/webextension-port-json-rpc";
import { AccountVaultAddress, RedditEIP712Challenge } from "./api-client";
import {
  ErrorCode,
  RedditCreateAddressOwnershipChallenge,
  RedditCreateAddressOwnershipChallengeParams,
  RedditGetAccountVaultAddresses,
  RedditGetUserProfile,
  RedditGetUserVaultAddress,
  RedditGetUserVaultAddressParams,
  RedditRegisterAddressWithAccount,
  RedditRegisterAddressWithAccountParams,
  RedditUserProfile,
} from "./reddit-interaction-spec";

export { AccountVaultAddress, RedditEIP712Challenge } from "./api-client";

export type EmptyCallback = () => void;
export interface RedditProviderEvents {
  /** Fired when the other end disconnects from us. */
  disconnected: EmptyCallback;
  /** Fired to disconnect ourself from the other end. */
  disconnectSelf: EmptyCallback;
}

export class RedditProviderError extends Error {
  type: ErrorCode | null;
  constructor(
    options: ErrorOptions & { type: ErrorCode | null; message: string },
  ) {
    super(options.message, { cause: options.cause });
    this.type = options.type;
  }

  static from(error: JSONRPCErrorException): RedditProviderError {
    const type =
      error.code === ErrorCode.USER_NOT_LOGGED_IN ||
      error.code === ErrorCode.SESSION_EXPIRED ||
      error.code === ErrorCode.REDDIT_TAB_DISCONNECTED
        ? error.code
        : null;
    return new RedditProviderError({
      type,
      message: error.message,
      cause: error,
    });
  }
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
    port.onDisconnect.addListener(() => {
      rp.emitter.emit("disconnected");
    });
    return rp;
  }

  readonly emitter: Emitter<RedditProviderEvents> = createNanoEvents();

  constructor(options: { redditInteractionClient: JSONRPCClient }) {
    const client = options.redditInteractionClient;
    this.getUserProfile = createRCPMethodCaller({
      method: RedditGetUserProfile,
      client,
      mapError: RedditProviderError.from,
    });
    this.createAddressOwnershipChallenge = createRCPMethodCaller({
      method: RedditCreateAddressOwnershipChallenge,
      client,
      mapError: RedditProviderError.from,
    });
    this.registerAddressWithAccount = createRCPMethodCaller({
      method: RedditRegisterAddressWithAccount,
      client,
      mapError: RedditProviderError.from,
    });
    this.getUserVaultAddress = createRCPMethodCaller({
      method: RedditGetUserVaultAddress,
      client,
      mapError: RedditProviderError.from,
    });
    this.getAccountVaultAddresses = createRCPMethodCaller({
      method: RedditGetAccountVaultAddresses,
      client,
      mapError: RedditProviderError.from,
    });
  }

  // TODO: should we make these return functional error values rather than throw?

  getUserProfile: () => Promise<RedditUserProfile>;
  createAddressOwnershipChallenge: (
    params: RedditCreateAddressOwnershipChallengeParams,
  ) => Promise<RedditEIP712Challenge>;
  registerAddressWithAccount: (
    params: RedditRegisterAddressWithAccountParams,
  ) => Promise<null>;
  getUserVaultAddress: (
    params: RedditGetUserVaultAddressParams,
  ) => Promise<Address | null>;
  getAccountVaultAddresses: () => Promise<Array<AccountVaultAddress>>;
}
