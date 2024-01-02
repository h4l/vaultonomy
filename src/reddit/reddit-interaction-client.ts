import { JSONRPCClient } from "json-rpc-2.0";
import { Emitter, createNanoEvents } from "nanoevents";

import { createRCPMethodCaller } from "../rpc/typing";
import {
  bindPortToJSONRPCClient,
  createPortSendRequestFn,
} from "../rpc/webextension-port-json-rpc";
import { RedditEIP712Challenge } from "./api-client";
import {
  RedditCreateAddressOwnershipChallenge,
  RedditCreateAddressOwnershipChallengeParams,
  RedditGetAccountVaultAddress,
  RedditGetUserProfile,
  RedditRegisterAddressWithAccount,
  RedditRegisterAddressWithAccountParams,
  RedditUserProfile,
} from "./reddit-interaction-spec";

export type EmptyCallback = () => void;
export interface RedditProviderEvents {
  /** Fired when the other end disconnects from us. */
  disconnected: EmptyCallback;
  /** Fired to disconnect ourself from the other end. */
  disconnectSelf: EmptyCallback;
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
    });
    this.createAddressOwnershipChallenge = createRCPMethodCaller({
      method: RedditCreateAddressOwnershipChallenge,
      client,
    });
    this.registerAddressWithAccount = createRCPMethodCaller({
      method: RedditRegisterAddressWithAccount,
      client,
    });
    this.getAccountVaultAddress = createRCPMethodCaller({
      method: RedditGetAccountVaultAddress,
      client,
    });
  }

  getUserProfile: () => Promise<RedditUserProfile>;
  createAddressOwnershipChallenge: (
    params: RedditCreateAddressOwnershipChallengeParams,
  ) => Promise<RedditEIP712Challenge>;
  registerAddressWithAccount: (
    params: RedditRegisterAddressWithAccountParams,
  ) => Promise<null>;
  getAccountVaultAddress: () => Promise<string | null>;
}
