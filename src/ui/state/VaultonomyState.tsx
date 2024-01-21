import { Emitter, createNanoEvents } from "nanoevents";
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
import { boolean, z } from "zod";

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
  RedditUserProfile,
} from "../../reddit/reddit-interaction-spec";
import {
  ConfigRequirements,
  WagmiConfigManager,
  WalletConnectorType,
  isUserRejectedRequestError,
  walletConnectorTypes,
} from "../../wagmi";
import { getMetaMaskExtensionId } from "../../webextensions/extension-ids";
import { VaultonomyBackgroundProvider } from "../rpc/VaultonomyBackgroundProvider";
import { getIncreasingId } from "./increasing-ids";
import { useVaultonomyBackgroundProvider } from "./useVaultonomyBackgroundProvider";

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

type AsyncValue<T> =
  | { state: "loading" | "failed"; id: number }
  | { state: "loaded"; value: T; id: number };

type RedditState = TabAvailableRedditState | TabNotAvailableRedditState;
type TabNotAvailableRedditState = { state: "tabNotAvailable" };
type TabAvailableRedditState = {
  state: "tabAvailable";
  userProfile?: AsyncValue<RedditUserProfile>;
  vaultAddresses?: AsyncValue<ReadonlyArray<AccountVaultAddress>>;
  // TODO: add other states for Reddit Data
};

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
}
interface RedditTabBecameUnavailableAction {
  type: "redditTabBecameUnavailable";
}

type AsyncValueLoadActions<N extends string, T> = {
  type: N;
} & AsyncValue<T>;

type RedditProfileAvailabilityChangedActions = AsyncValueLoadActions<
  "redditProfileAvailabilityChanged",
  RedditUserProfile
>;
type RedditVaultsAvailabilityChangedActions = AsyncValueLoadActions<
  "redditVaultsAvailabilityChanged",
  Array<AccountVaultAddress>
>;

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
  | RedditProfileAvailabilityChangedActions
  | RedditVaultsAvailabilityChangedActions;

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
      if (vaultonomy.redditState.state === "tabNotAvailable") {
        return vaultonomy;
      }
      return { ...vaultonomy, redditState: { state: "tabNotAvailable" } };
    }
    case "redditTabBecameAvailable": {
      if (vaultonomy.redditState.state === "tabAvailable") {
        return vaultonomy;
      }
      return { ...vaultonomy, redditState: { state: "tabAvailable" } };
    }
    case "redditProfileAvailabilityChanged": {
      if (vaultonomy.redditState.state === "tabNotAvailable") return vaultonomy;
      if ((vaultonomy.redditState.userProfile?.id ?? 0) > action.id)
        return vaultonomy;
      return {
        ...vaultonomy,
        redditState: { ...vaultonomy.redditState, userProfile: action },
      };
    }
    case "redditVaultsAvailabilityChanged": {
      if (vaultonomy.redditState.state === "tabNotAvailable") return vaultonomy;
      if ((vaultonomy.redditState.vaultAddresses?.id ?? 0) > action.id)
        return vaultonomy;
      return {
        ...vaultonomy,
        redditState: { ...vaultonomy.redditState, vaultAddresses: action },
      };
    }
  }
  assertUnreachable(action);
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

type AsyncDriverEvents = {
  stopped: () => void;
};

abstract class AsyncDriver<State = any, Action = any> {
  #stopped: boolean = false;
  emitter: Emitter<AsyncDriverEvents> = createNanoEvents();
  private runningReconciliation?: Promise<void>;

  async reconcile(state: State, dispatch: (action: Action) => void) {
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

  protected abstract doReconcile(
    state: State,
    dispatch: (action: Action) => void,
  ): Promise<void>;

  get stopped(): boolean {
    return this.#stopped;
  }

  stop(): void {
    this.#stopped = true;
    this.emitter.emit("stopped");
  }
}

function useDriveAsync<S, A, T extends AsyncDriver<S, A>>({
  initializer,
  state,
  dispatch,
  getDependencies,
}: {
  initializer: () => T;
  state: S;
  dispatch: (action: A) => void;
  getDependencies?: (state: S) => unknown[];
}) {
  const [asyncDriver, setAsyncDriver] = useState<T>();

  useEffect(() => {
    const createdAsyncDriver = initializer();
    setAsyncDriver(createdAsyncDriver);
    return () => createdAsyncDriver.stop();
  }, []);

  useEffect(() => {
    if (!asyncDriver) return;
    let cancelled = false;

    // Ensure only one reconcile runs at a time
    (async () => {
      if (cancelled) return;
      await asyncDriver.idle();
      if (!cancelled) {
        asyncDriver.reconcile(state, dispatch);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [asyncDriver, ...(getDependencies ? getDependencies(state) : [])]);
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

  static getDependencies(state: VaultonomyState): unknown[] {
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

interface VaultonomyBackgroundProviderDriverState {
  vaultonomy: VaultonomyState;
  provider: VaultonomyBackgroundProvider | undefined;
}

type Unbind = () => void;

class VaultonomyBackgroundProviderDriver extends AsyncDriver<
  VaultonomyBackgroundProviderDriverState,
  VaultonomyAction
> {
  private provider?: VaultonomyBackgroundProvider;
  private unbindProvider?: Unbind;
  private redditProvider?: RedditProvider;
  private loadingProfile?: Promise<RedditUserProfile>;
  private loadingVaultAddresses?: Promise<Array<AccountVaultAddress>>;

  static getDependencies({
    vaultonomy: { redditState },
    provider,
  }: VaultonomyBackgroundProviderDriverState): unknown[] {
    return [redditState, provider];
  }

  protected doCancel(): void {}

  protected async doReconcile(
    {
      vaultonomy: { redditState: _redditState },
      provider,
    }: VaultonomyBackgroundProviderDriverState,
    dispatch: DispatchFn,
  ): Promise<void> {
    // Reset loading state when provider changes or becomes unavailable
    if (this.provider !== provider) {
      if (this.unbindProvider) this.unbindProvider();
      this.provider = provider;
      this.unbindProvider = provider?.emitter.on(
        "availabilityStatus",
        (event) => {
          switch (event.type) {
            case "redditTabBecameAvailable":
              this.redditProvider = event.redditProvider;
              dispatch({ type: "redditTabBecameAvailable" });
              break;
            case "redditTabBecameUnavailable":
              this.redditProvider = undefined;
              dispatch({ type: "redditTabBecameUnavailable" });
              break;
            default:
              assertUnreachable(event);
          }
        },
      );
      this.loadingProfile = undefined;
      this.loadingVaultAddresses = undefined;
      await provider?.requestAvailabilityStatus();
    }
    const redditProvider = this.redditProvider;

    if (provider === undefined || redditProvider === undefined) {
      return;
    }

    if (!this.loadingProfile) {
      this.loadingProfile = dispatchAsyncValueLoadActions({
        type: "redditProfileAvailabilityChanged",
        asyncValue: retry({
          action: async () => await redditProvider.getUserProfile(),
          canRetry: oneRedditProviderError,
        }),
        dispatch,
      });
    }

    if (!this.loadingVaultAddresses) {
      this.loadingVaultAddresses = dispatchAsyncValueLoadActions({
        type: "redditVaultsAvailabilityChanged",
        asyncValue: retry({
          action: async () => await redditProvider.getAccountVaultAddresses(),
          canRetry: oneRedditProviderError,
        }),
        dispatch,
      });
    }
  }
}

async function dispatchAsyncValueLoadActions<N extends string, T>({
  type,
  asyncValue,
  dispatch,
}: {
  type: N;
  asyncValue: Promise<T>;
  dispatch: (action: AsyncValueLoadActions<N, T>) => void;
}): Promise<T> {
  const id = getIncreasingId();
  try {
    dispatch({ type, id, state: "loading" });
    const value = await asyncValue;
    dispatch({ type, id, state: "loaded", value });
    return value;
  } catch (error) {
    dispatch({ type, id, state: "failed" });
    throw error;
  }
}

const oneRedditProviderError: RetryPredicate = (error, attempt) =>
  attempt == 1 && error instanceof RedditProviderError;

type RetryPredicate = (error: unknown, attempt: number) => boolean;

async function retry<T>({
  action,
  canRetry: retryWhile,
}: {
  action: () => Promise<T>;
  canRetry: RetryPredicate;
}): Promise<T> {
  for (let attempt = 1; ; ++attempt) {
    try {
      return await action();
    } catch (error) {
      if (retryWhile(error, attempt)) {
        continue;
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
    getDependencies: WalletDriver.getDependencies,
  });

  const vaultonomyBackgroundProvider = useVaultonomyBackgroundProvider();

  useDriveAsync({
    initializer: () => new VaultonomyBackgroundProviderDriver(),
    state: { vaultonomy, provider: vaultonomyBackgroundProvider },
    dispatch,
    getDependencies: VaultonomyBackgroundProviderDriver.getDependencies,
  });

  return (
    <VaultonomyStateContext.Provider value={[vaultonomy, dispatch]}>
      {children}
    </VaultonomyStateContext.Provider>
  );
}
