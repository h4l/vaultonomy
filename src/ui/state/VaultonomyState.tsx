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

import { assert, assertUnreachable } from "../../assert";
import {
  ConfigRequirements,
  WagmiConfigManager,
  WalletConnectorType,
  isUserRejectedRequestError,
  walletConnectorTypes,
} from "../../wagmi";
import { getMetaMaskExtensionId } from "../../webextensions/extension-ids";

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
  | WalletAddressEnsNameFetchedAction;

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

  getDependencies(_state: State): Array<unknown> {
    return [];
  }

  protected abstract doReconcile(
    state: State,
    dispatch: (action: Action) => void,
  ): Promise<void>;
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

  return (
    <VaultonomyStateContext.Provider value={[vaultonomy, dispatch]}>
      {children}
    </VaultonomyStateContext.Provider>
  );
}
