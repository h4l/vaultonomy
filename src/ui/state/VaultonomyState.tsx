import {
  ReactNode,
  createContext,
  useEffect,
  useReducer,
  useState,
} from "react";
import { UserRejectedRequestError } from "viem";
import { Address } from "wagmi";
import { connect, disconnect, fetchEnsName, getAccount } from "wagmi/actions";
import { Browser, action } from "webextension-polyfill";
import { z } from "zod";

import { assert, assertUnreachable } from "../../assert";
import {
  RedditTabBecameAvailableEvent,
  RedditTabBecameUnavailableEvent,
} from "../../messaging";
import {
  AccountVaultAddress,
  RedditProvider,
  RedditProviderError,
} from "../../reddit/reddit-interaction-client";
import {
  ErrorCode,
  REDDIT_INTERACTION,
  RedditUserProfile,
} from "../../reddit/reddit-interaction-spec";
import {
  ConfigRequirements,
  WagmiConfigManager,
  WalletConnectorType,
  isUserRejectedRequestError,
  walletConnectorTypes,
} from "../../wagmi";
import { browser } from "../../webextension";
import { getMetaMaskExtensionId } from "../../webextensions/extension-ids";
import { getIncreasingId } from "./increasing-ids";

type DispatchFn = (action: VaultonomyAction) => void;

type IntendedWalletState =
  | { state: "disconnected"; id: number }
  | { state: "connected"; id: number; walletType: WalletConnectorType };

type WalletState =
  | {
      state: "disconnected";
      failedAttempt?: {
        walletConnector: WalletConnectorType;
        connectionError: string;
      };
    }
  | { state: "disconnecting" }
  | { state: "connecting"; walletConnector: WalletConnectorType }
  | {
      state: "connected";
      walletConnector: WalletConnectorType;
      address: Address;
      ensName?: string;
    };

type PairingState =
  | { userState: "disinterested" }
  | { userState: "interested" };

// redditTabNotAvailable — contentscript not running in any Reddit tab
// redditTabAvailable — contentscript running in a Reddit tab, and we have the tabId from the backend
// redditTabConnecting — we are connecting to the reddit tab
// redditTabConnected — we have established communication with the Reddit tab

// Send one-shot message to get tab ID
// Backend publishes availability of tab ID when connected

type AsyncRequest = {
  state: "started" | "succeeded" | "failed";
  id: number;
};

type RedditState = TabAvailableRedditState | TabNotAvailableRedditState;
type TabNotAvailableRedditState = { state: "tabNotAvailable" };
type TabAvailableRedditState = {
  state: "tabAvailable";
  providerRequests: Partial<Record<RedditProviderRequestType, AsyncRequest>>;
  tabId: number;
  userProfile?: RedditUserProfile;
  vaultAddresses?: ReadonlyArray<AccountVaultAddress>;
  // TODO: add other states for Reddit Data
};
// | { state: "tabConnecting"; tabId: number }
// | { state: "tabConnected"; tabId: number };

/**
 * ## Wallet States
 *
 * - Disconnected
 *  - Connection failure details
 * - Connecting
 *  - Chosen Wallet Connector
 * - Connected
 *  - Wallet/account info
 */
export interface VaultonomyState {
  metaMaskExtensionId?: string | null;
  intendedWalletState: IntendedWalletState;
  walletState: WalletState;
  usableWalletConnectors: Record<WalletConnectorType, boolean>;
  intendedPairingState: PairingState;
  redditState: RedditState;
}

interface SystemProbedForMetaMaskExtensionAction {
  type: "systemProbedForMetaMaskExtension";
  metaMaskExtensionId: string | null;
}

interface UserDisconnectedWalletAction {
  type: "userDisconnectedWallet";
}
interface UserInitiatedWalletConnectionAction {
  type: "userInitiatedWalletConnection";
  chosenWalletType: WalletConnectorType;
}
interface WalletBeganConnectingAction {
  type: "walletBeganConnecting";
  walletType: WalletConnectorType;
}
interface WalletBeganDisconnectingAction {
  type: "walletBeganDisconnecting";
}
interface WalletDidDisconnectAction {
  type: "walletDidDisconnect";
}
interface UserCancelledWalletConnectAction {
  type: "userCancelledWalletConnect";
}
interface WalletFailedToConnectAction {
  type: "walletFailedToConnect";
  walletType: WalletConnectorType;
  reason: string;
}
interface WalletDidConnectAction {
  type: "walletDidConnect";
  walletType: WalletConnectorType;
  address: Address;
}
interface WalletConnectorUsabilityChangedAction {
  type: "walletConnectorUsabilityChanged";
  walletType: WalletConnectorType;
  isUsable: boolean;
}
interface WalletAddressEnsNameFetchedAction {
  type: "walletAddressEnsNameFetched";
  address: Address;
  ensName: string;
}
interface UserExpressedInterestInPairingAction {
  type: "userExpressedInterestInPairing";
}

interface RedditTabBecameAvailableAction {
  type: "redditTabBecameAvailable";
  tabId: number;
}
interface RedditTabBecameUnavailableAction {
  type: "redditTabBecameUnavailable";
  tabId: number;
}
// interface SystemFetchedUserProfileFromRedditAction {
//   type: "systemFetchedUserProfileFromReddit";
//   tabId: number;
//   userProfile: RedditUserProfile;
// }
// interface SystemFailedToFetchUserProfileFromRedditAction {
//   type: "systemFailedToFetchUserProfileFromReddit";
//   tabId: number;
// }
// interface SystemFetchedAccountVaultAddressesFromRedditAction {
//   type: "systemFetchedAccountVaultAddressesFromReddit";
//   tabId: number;
//   vaultAddresses: ReadonlyArray<AccountVaultAddress>;
// }
// interface SystemFailedToFetchAccountVaultAddressesFromRedditAction {
//   type: "systemFailedToFetchAccountVaultAddressesFromReddit";
//   tabId: number;
// }

type _RedditProviderMethods = Omit<RedditProvider, "emitter">;
type RedditProviderRequestType = keyof _RedditProviderMethods;
type RedditProviderResult<RT extends RedditProviderRequestType> = Awaited<
  ReturnType<RedditProvider[RT]>
>;

type RedditProviderRequestStarted<RT extends RedditProviderRequestType> = {
  progressType: "started";
  id: number;
  requestType: RT;
};
type RedditProviderRequestSucceeded<RT extends RedditProviderRequestType> = {
  progressType: "succeeded";
  id: number;
  requestType: RT;
  value: RedditProviderResult<RT>;
};
type RedditProviderRequestFailed<RT extends RedditProviderRequestType> = {
  progressType: "failed";
  requestType: RT;
  id: number;
  error: RedditProviderError;
};

/**
 * This event is used to report status of requests to Reddit via RedditProvider.
 */
interface SystemProgressedRequestToRedditAction<
  RT extends RedditProviderRequestType = RedditProviderRequestType,
> {
  type: "systemProgressedRequestToReddit";
  progression:
    | RedditProviderRequestStarted<RT>
    | RedditProviderRequestSucceeded<RT>
    | RedditProviderRequestFailed<RT>;
}

type VaultonomyAction =
  | SystemProbedForMetaMaskExtensionAction
  | UserDisconnectedWalletAction
  | UserInitiatedWalletConnectionAction
  | WalletBeganConnectingAction
  | WalletBeganDisconnectingAction
  | WalletDidDisconnectAction
  | UserCancelledWalletConnectAction
  | WalletFailedToConnectAction
  | WalletDidConnectAction
  | WalletConnectorUsabilityChangedAction
  | WalletAddressEnsNameFetchedAction
  | UserExpressedInterestInPairingAction
  | RedditTabBecameAvailableAction
  | RedditTabBecameUnavailableAction
  // | SystemFetchedUserProfileFromRedditAction
  // | SystemFailedToFetchUserProfileFromRedditAction
  // | SystemFetchedAccountVaultAddressesFromRedditAction
  // | SystemFailedToFetchAccountVaultAddressesFromRedditAction;
  // | SystemBeganConnectingToRedditTabAction
  // | SystemConnectedToRedditTabAction;
  | SystemProgressedRequestToRedditAction;

export function vaultonomyStateReducer(
  vaultonomy: VaultonomyState,
  action: VaultonomyAction,
): VaultonomyState {
  switch (action.type) {
    case "systemProbedForMetaMaskExtension": {
      return { ...vaultonomy, metaMaskExtensionId: action.metaMaskExtensionId };
    }
    // TODO: need to pair user intent to wallet action so that if a connect
    // attempt fails, we don't keep re-attempting to connect based on the unmet
    // user intent
    case "userDisconnectedWallet": {
      return {
        ...vaultonomy,
        intendedWalletState: {
          state: "disconnected",
          id: vaultonomy.intendedWalletState.id + 1,
        },
      };
    }
    case "userInitiatedWalletConnection": {
      return {
        ...vaultonomy,
        intendedWalletState: {
          state: "connected",
          id: vaultonomy.intendedWalletState.id + 1,
          walletType: action.chosenWalletType,
        },
      };
    }
    case "walletConnectorUsabilityChanged": {
      return {
        ...vaultonomy,
        usableWalletConnectors: {
          ...vaultonomy.usableWalletConnectors,
          [action.walletType]: action.isUsable,
        },
      };
    }
    case "walletBeganConnecting": {
      return {
        ...vaultonomy,
        walletState: {
          state: "connecting",
          walletConnector: action.walletType,
        },
      };
    }
    case "walletDidConnect": {
      return {
        ...vaultonomy,
        walletState: {
          state: "connected",
          walletConnector: action.walletType,
          address: action.address,
        },
      };
    }
    case "walletBeganDisconnecting": {
      return {
        ...vaultonomy,
        walletState: { state: "disconnecting" },
      };
    }
    case "walletDidDisconnect": {
      return {
        ...vaultonomy,
        walletState: { state: "disconnected" },
      };
    }
    case "userCancelledWalletConnect": {
      return {
        ...vaultonomy,
        walletState: { state: "disconnected" },
        intendedWalletState: {
          state: "disconnected",
          id: vaultonomy.intendedWalletState.id + 1,
        },
      };
    }
    case "walletFailedToConnect": {
      return {
        ...vaultonomy,
        walletState: {
          state: "disconnected",
          failedAttempt: {
            walletConnector: action.walletType,
            connectionError: action.reason,
          },
        },
      };
    }
    case "walletAddressEnsNameFetched": {
      if (
        vaultonomy.walletState.state !== "connected" ||
        action.address !== vaultonomy.walletState.address
      ) {
        return vaultonomy;
      }
      return {
        ...vaultonomy,
        walletState: { ...vaultonomy.walletState, ensName: action.ensName },
      };
    }
    case "userExpressedInterestInPairing": {
      return {
        ...vaultonomy,
        intendedPairingState: { userState: "interested" },
      };
    }
    case "redditTabBecameUnavailable": {
      if (
        vaultonomy.redditState.state === "tabNotAvailable" ||
        action.tabId !== vaultonomy.redditState.tabId
      ) {
        return vaultonomy;
      }
      return {
        ...vaultonomy,
        redditState: { state: "tabNotAvailable" },
      };
    }
    case "redditTabBecameAvailable": {
      if (
        vaultonomy.redditState.state !== "tabNotAvailable" &&
        vaultonomy.redditState.tabId === action.tabId
      ) {
        return vaultonomy;
      }
      return {
        ...vaultonomy,
        redditState: {
          state: "tabAvailable",
          providerRequests: {},
          tabId: action.tabId,
        },
      };
    }
    case "systemProgressedRequestToReddit": {
      return systemProgressedRequestToRedditActionVaultonomyStateReducer(
        vaultonomy,
        action,
      );
    }
    // case "systemFailedToFetchUserProfileFromReddit": {
    //   if (
    //     vaultonomy.redditState.state === "tabAvailable" &&
    //     vaultonomy.redditState.tabId === action.tabId
    //   ) {
    //     return {
    //       ...vaultonomy,
    //       redditState: {
    //         state: "tabAvailable",
    //         tabId: action.tabId,
    //         userProfile: undefined,
    //       },
    //     };
    //   }
    //   return vaultonomy;
    // }
    // case "systemFetchedUserProfileFromReddit": {
    //   if (
    //     vaultonomy.redditState.state === "tabAvailable" &&
    //     vaultonomy.redditState.tabId === action.tabId
    //   ) {
    //     return {
    //       ...vaultonomy,
    //       redditState: {
    //         ...vaultonomy.redditState,
    //         userProfile: action.userProfile,
    //       },
    //     };
    //   }
    //   return vaultonomy;
    // }
    // case "systemFetchedAccountVaultAddressesFromReddit": {
    //   if (
    //     vaultonomy.redditState.state === "tabAvailable" &&
    //     vaultonomy.redditState.tabId === action.tabId
    //   ) {
    //     return {
    //       ...vaultonomy,
    //       redditState: {
    //         ...vaultonomy.redditState,
    //         vaultAddresses: action.vaultAddresses,
    //       },
    //     };
    //   }
    //   return vaultonomy;
    // }
  }
  assertUnreachable(action);
}

function systemProgressedRequestToRedditActionVaultonomyStateReducer(
  vaultonomy: VaultonomyState,
  action: SystemProgressedRequestToRedditAction,
): VaultonomyState {
  if (vaultonomy.redditState.state === "tabNotAvailable") {
    return vaultonomy;
  }
  const { requestType, id } = action.progression;
  const progression = action.progression;

  const currentRequest =
    vaultonomy.redditState.providerRequests[action.progression.requestType];
  if (currentRequest && currentRequest.id > id) {
    return vaultonomy;
  }

  const providerRequests: TabAvailableRedditState["providerRequests"] = {
    ...vaultonomy.redditState.providerRequests,
    [requestType]: { state: "started", id },
  };

  let redditState: TabAvailableRedditState;
  if (progression.progressType === "succeeded") {
    redditState = {
      ...vaultonomy.redditState,
      providerRequests,
    };
    switch (progression.requestType) {
      case "getUserProfile":
        redditState.userProfile = progression.value as RedditProviderResult<
          typeof progression.requestType
        >;
        break;
      case "getAccountVaultAddresses":
        redditState.vaultAddresses = progression.value as RedditProviderResult<
          typeof progression.requestType
        >;
        break;
      default:
        throw new Error(
          `Storing value of Reddit request not implemented: ${progression.requestType}`,
        );
    }
    return { ...vaultonomy, redditState };
  } else if (
    progression.progressType === "started" ||
    progression.progressType === "failed"
  ) {
    redditState = {
      ...vaultonomy.redditState,
      providerRequests,
    };
    switch (progression.requestType) {
      case "getUserProfile":
        redditState.userProfile = undefined;
        break;
      case "getAccountVaultAddresses":
        redditState.vaultAddresses = undefined;
        break;
      default:
        throw new Error(
          `Storing value of Reddit request not implemented: ${progression.requestType}`,
        );
    }
    return { ...vaultonomy, redditState };
  }
  assertUnreachable(progression);
}

function defaultVaultonomyState(): VaultonomyState {
  return {
    intendedWalletState: { state: "disconnected", id: 0 },
    walletState: { state: "disconnected" },
    usableWalletConnectors: {
      [WalletConnectorType.MetaMask]: false,
      [WalletConnectorType.Coinbase]: false,
      [WalletConnectorType.WalletConnect]: false,
    },
    intendedPairingState: { userState: "disinterested" },
    redditState: { state: "tabNotAvailable" },
  };
}

function defaultDispatch(): never {
  assert(
    false,
    "defaultVaultonomyState().dispatch(...) unexpectedly called: this " +
      "VaultonomyState should have been replaced with the return value of useRootVaultonomyState()",
  );
}

export const VaultonomyStateContext = createContext<
  [VaultonomyState, DispatchFn]
>([defaultVaultonomyState(), defaultDispatch]);

export function useRootVaultonomyState(): [VaultonomyState, DispatchFn] {
  return useReducer(vaultonomyStateReducer, undefined, defaultVaultonomyState);
}

abstract class AsyncDriver<State = any, Action = any> {
  #isCancelled: boolean = false;
  private runningReconciliation?: Promise<void>;

  // Promise?
  cancel(): void {
    this.#isCancelled = true;
    this.doCancel();
  }

  get isCancelled(): boolean {
    return this.#isCancelled;
  }

  async reconcile(state: State, dispatch: (action: Action) => void) {
    if (this.isCancelled) {
      throw new Error("reconcile called when cancelled");
    }
    if (this.runningReconciliation !== undefined) {
      throw new Error(
        "reconcile called with an existing runningReconciliation",
      );
    }
    this.runningReconciliation = this.doReconcile(state, dispatch);
    try {
      return await this.runningReconciliation;
    } finally {
      this.runningReconciliation = undefined;
    }
  }

  async idle(): Promise<void> {
    try {
      await this.runningReconciliation;
    } catch (e) {
      console.error(
        "AsyncDriver.idle(): runningReconciliation failed while being awaited",
        e,
      );
    }
  }

  getDependencies(_state: State): Array<unknown> {
    return [];
  }

  protected abstract doReconcile(
    state: State,
    dispatch: (action: Action) => void,
  ): Promise<void>;

  protected doCancel(): void {}
}

function useDriveAsync<S, A, T extends AsyncDriver<S, A>>({
  initializer,
  state,
  dispatch,
}: {
  initializer: () => T;
  state: S;
  dispatch: (action: A) => void;
}) {
  const [asyncDriver, _] = useState(initializer);
  useEffect(() => {
    return () => asyncDriver.cancel();
  }, []);
  useEffect(() => {
    let cancelled = false;

    // Ensure only one reconcile runs at a time
    (async () => {
      await asyncDriver.idle();
      if (!cancelled) {
        asyncDriver.reconcile(state, dispatch);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, asyncDriver.getDependencies(state));
}

class MetaMaskExtensionDetector extends AsyncDriver<
  undefined,
  VaultonomyAction
> {
  protected async doReconcile(
    _state: undefined,
    dispatch: (action: VaultonomyAction) => void,
  ): Promise<void> {
    const metaMaskExtensionId = await getMetaMaskExtensionId();
    dispatch({
      type: "systemProbedForMetaMaskExtension",
      metaMaskExtensionId,
    });
  }
}

/**
 * Responsible for communication between Vaultonomy and the user's Wallet.
 *
 * The WalletDriver affects changes to Wagmi's state to reflect user
 * intentions, as defined by the VaultonomyState — enabling Connectors, using
 * Connectors to connect to the user's wallet, initiating signing requests. And
 * it dispatches actions as the Wallet state changes and data is fetched, to
 * allow Vaultonomy to reflect the external Wallet state.
 */
class WalletDriver extends AsyncDriver<VaultonomyState, VaultonomyAction> {
  private lastFailedConnectionIntendedWalletStateId?: number;
  constructor(public readonly configManager: WagmiConfigManager) {
    super();
  }

  getDependencies(state: VaultonomyState): unknown[] {
    return [state.intendedWalletState, state.metaMaskExtensionId];
  }

  private async doDisconnect(dispatch: DispatchFn) {
    dispatch({ type: "walletBeganDisconnecting" });
    await disconnect();
    dispatch({ type: "walletDidDisconnect" });
  }

  protected async doReconcile(
    vaultonomy: VaultonomyState,
    dispatch: DispatchFn,
  ) {
    const configRequirements = new ConfigRequirements(
      vaultonomy.intendedWalletState.state === "connected"
        ? vaultonomy.intendedWalletState.walletType
        : undefined,
      vaultonomy.metaMaskExtensionId || undefined,
    );
    let current = this.configManager.current;

    if (!current || !configRequirements.equals(current.requirements)) {
      // Must disconnect before re-configuring, otherwise the Connector remains
      // connected.
      if (this.configManager.isConfigConnected()) {
        await this.doDisconnect(dispatch);
      }
      ({ current } = this.configManager.applyRequirements(configRequirements));
    }

    for (const walletType of walletConnectorTypes) {
      const isUsable = this.configManager.isConnectorUsable(walletType);
      if (vaultonomy.usableWalletConnectors[walletType] !== isUsable) {
        dispatch({
          type: "walletConnectorUsabilityChanged",
          walletType,
          isUsable,
        });
      }
    }

    if (vaultonomy.intendedWalletState.state === "disconnected") {
      if (!getAccount().isDisconnected) {
        await this.doDisconnect(dispatch);
      }
      return;
    } else {
      // We must notice if we're not connected because a previous connection
      // attempt failed, otherwise we'd continuously retry.
      if (
        vaultonomy.intendedWalletState.id ===
        this.lastFailedConnectionIntendedWalletStateId
      ) {
        return;
      }

      const connector = current.getRequiredConnector();
      // We know the connector as it is defined in the intendedWalletState
      assert(connector !== undefined);

      if (
        !getAccount().isConnected &&
        !Object.is(connector, getAccount().connector)
      ) {
        if (!getAccount().isDisconnected) {
          await this.doDisconnect(dispatch);
        }
        let address: Address | undefined;
        try {
          dispatch({
            type: "walletBeganConnecting",
            walletType: vaultonomy.intendedWalletState.walletType,
          });
          await connect({ connector });
          let status;
          ({ address, status } = getAccount());
          if (!address) {
            throw new Error(
              `no address available after connect succeeded; status=${status}`,
            );
          }
          dispatch({
            type: "walletDidConnect",
            walletType: vaultonomy.intendedWalletState.walletType,
            address,
          });
        } catch (error) {
          this.lastFailedConnectionIntendedWalletStateId =
            vaultonomy.intendedWalletState.id;
          if (isUserRejectedRequestError(error)) {
            dispatch({ type: "userCancelledWalletConnect" });
            return;
          }
          dispatch({
            type: "walletFailedToConnect",
            walletType: vaultonomy.intendedWalletState.walletType,
            reason: (error as Error | undefined)?.message ?? "Unknown error",
          });
          return;
        }

        try {
          await this.fetchAndDispatchAccountDetails(address, dispatch);
        } catch (e) {
          // Currently this is just resolving the ENS name of the address, it's
          // not a blocker if this doesn't work.
          console.log(
            `Request to fetch account details after connect failed: `,
            e,
          );
        }
      }
    }
  }

  private async fetchAndDispatchAccountDetails(
    address: Address,
    dispatch: DispatchFn,
  ) {
    const ensName = await fetchEnsName({ address });
    if (ensName) {
      dispatch({ type: "walletAddressEnsNameFetched", address, ensName });
    }
  }
}

// function useRedditProvider(): RedditProvider | undefined {
//   const [tabId, setTabId] = useState<number>();
//   useEffect(() => {

//   });

// }

const RedditDriverMessage = z.discriminatedUnion("type", [
  RedditTabBecameAvailableEvent,
  RedditTabBecameUnavailableEvent,
]);
type RedditDriverMessage = z.infer<typeof RedditDriverMessage>;

class RedditDriver extends AsyncDriver<VaultonomyState, VaultonomyAction> {
  #onMessageHandler?: (message: unknown) => void;
  #connection:
    | {
        tabId: number;
        redditProvider: RedditProvider;
        profile?: RedditUserProfile;
      }
    | undefined;
  // #redditTab: chrome.tabs.Tab | undefined;
  // #port: chrome.runtime.Port | undefined;
  getDependencies({ redditState }: VaultonomyState): unknown[] {
    return [redditState];
  }

  protected doCancel(): void {
    if (this.#onMessageHandler)
      browser.runtime.onMessage.removeListener(this.#onMessageHandler);
  }

  private listenForRedditTab(dispatch: DispatchFn): void {
    assert(!this.#onMessageHandler);
    this.#onMessageHandler = (message: unknown) => {
      const result = RedditDriverMessage.safeParse(message);
      if (!result.success) {
        if (import.meta.env.MODE === "development") {
          console.log("RedditDriver: ignored message", message);
        }
        return;
      }
      this.handleMessage(result.data, dispatch);
    };
    browser.runtime.onMessage.addListener(this.#onMessageHandler);
  }

  private handleMessage(
    message: RedditDriverMessage,
    dispatch: DispatchFn,
  ): void {
    switch (message.type) {
      case "redditTabBecameAvailable":
        dispatch({ type: "redditTabBecameAvailable", tabId: message.tabId });
        return;
      case "redditTabBecameUnavailable":
        dispatch({ type: "redditTabBecameUnavailable", tabId: message.tabId });
        return;
    }
    assertUnreachable(message);
  }

  protected async doReconcile(
    { redditState }: VaultonomyState,
    dispatch: DispatchFn,
  ): Promise<void> {
    if (!this.#onMessageHandler) {
      this.listenForRedditTab(dispatch);
      assert(this.#onMessageHandler);
    }

    if (redditState.state === "tabNotAvailable") {
      this.disconnectIfConnected();
      return;
    }
    if (this.#connection?.tabId === redditState.tabId) return;

    if (redditState.state === "tabAvailable") {
      const tabId = redditState.tabId;
      const redditProvider = RedditProvider.from(
        browser.tabs.connect(tabId, { name: REDDIT_INTERACTION }),
      );
      redditProvider.emitter.on("disconnected", () => {
        if (
          this.#connection?.tabId === tabId ||
          this.#connection?.redditProvider === redditProvider
        ) {
          this.disconnectIfConnected();
          dispatch({ type: "redditTabBecameUnavailable", tabId });
        }
      });
      // TODO: do we need tabId now that we use getIncreasingId()?
      this.#connection = { tabId, redditProvider, profile: undefined };
      await Promise.all([
        this.dispatchGetProfile(redditProvider, dispatch),
        this.dispatchGetVaultAddresses(redditProvider, dispatch),
      ]);
    }
  }

  private async dispatchGetProfile(
    redditProvider: RedditProvider,
    dispatch: DispatchFn,
  ): Promise<void> {
    await retryOrDispatchProviderCallError({
      requestType: "getUserProfile",
      dispatch,
      id: getIncreasingId(),
      providerCall: async () => await redditProvider.getUserProfile(),
    });
  }

  private async dispatchGetVaultAddresses(
    redditProvider: RedditProvider,
    dispatch: DispatchFn,
  ): Promise<void> {
    await retryOrDispatchProviderCallError({
      requestType: "getAccountVaultAddresses",
      dispatch,
      id: getIncreasingId(),
      providerCall: async () => await redditProvider.getAccountVaultAddresses(),
    });
  }

  private disconnectIfConnected() {
    this.#connection?.redditProvider.emitter.emit("disconnectSelf");
    this.#connection = undefined;
  }
}

async function retryOrDispatchProviderCallError<
  RT extends RedditProviderRequestType,
>({
  requestType,
  providerCall,
  dispatch,
  id,
}: {
  requestType: RT;
  providerCall: () => Promise<RedditProviderResult<RT>>;
  dispatch: DispatchFn;
  id: number;
}): Promise<void> {
  dispatch({
    type: "systemProgressedRequestToReddit",
    progression: { requestType, progressType: "started", id },
  });
  for (let attemptsRemaining = 2; attemptsRemaining > 0; --attemptsRemaining) {
    try {
      const value = await providerCall();
      dispatch({
        type: "systemProgressedRequestToReddit",
        progression: { requestType, progressType: "succeeded", id, value },
      });
      return;
    } catch (error) {
      if (error instanceof RedditProviderError) {
        if (error.type === ErrorCode.SESSION_EXPIRED) continue; // retry
        dispatch({
          type: "systemProgressedRequestToReddit",
          progression: { requestType, progressType: "failed", id, error },
        });
      }
      throw error;
    }
  }
}

export function VaultonomyRoot({
  children,
}: {
  children?: ReactNode;
}): JSX.Element {
  const [vaultonomy, dispatch] = useRootVaultonomyState();

  useDriveAsync({
    initializer: () => new MetaMaskExtensionDetector(),
    state: undefined,
    dispatch,
  });

  useDriveAsync({
    initializer: () => new WalletDriver(new WagmiConfigManager()),
    state: vaultonomy,
    dispatch,
  });

  // const redditProvider = useRedditProvider();

  useDriveAsync({
    initializer: () => new RedditDriver(),
    state: vaultonomy,
    dispatch,
  });

  return (
    <VaultonomyStateContext.Provider value={[vaultonomy, dispatch]}>
      {children}
    </VaultonomyStateContext.Provider>
  );
}
