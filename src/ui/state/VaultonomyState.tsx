import { ReactNode, createContext, useEffect, useReducer } from "react";
import { Config, WagmiConfig } from "wagmi";

import { assert, assertUnreachable } from "../../assert";
import {
  ConfigRequirements,
  WagmiConfigManager,
  WalletConnectorType,
} from "../../wagmi";
import { getMetaMaskExtensionId } from "../../webextensions/extension-ids";

type DispatchFn = (action: VaultonomyAction) => void;

export interface VaultonomyState {
  metaMaskExtensionId?: string;
  chosenWalletConnector?: WalletConnectorType;
}

interface MetaMaskDetectedAction {
  type: "metaMaskDetected";
  metaMaskExtensionId: string;
}
interface WalletConnectorChosenAction {
  type: "walletConnectorChosen";
  chosenWalletConnector: WalletConnectorType | undefined;
}

type VaultonomyAction = MetaMaskDetectedAction | WalletConnectorChosenAction;

export function vaultonomyStateReducer(
  vaultonomy: VaultonomyState,
  action: VaultonomyAction
): VaultonomyState {
  switch (action.type) {
    case "metaMaskDetected": {
      return { ...vaultonomy, metaMaskExtensionId: action.metaMaskExtensionId };
    }
    case "walletConnectorChosen": {
      return {
        ...vaultonomy,
        chosenWalletConnector: action.chosenWalletConnector,
      };
    }
  }
  assertUnreachable(action);
}

function defaultVaultonomyState(init?: undefined): VaultonomyState {
  return {};
}

function defaultDispatch(): never {
  assert(
    false,
    "defaultVaultonomyState().dispatch(...) unexpectedly called: this " +
      "VaultonomyState should have been replaced with the return value of useRootVaultonomyState()"
  );
}

export const VaultonomyStateContext = createContext<
  [VaultonomyState, DispatchFn]
>([defaultVaultonomyState(), defaultDispatch]);

export function useRootVaultonomyState(): [VaultonomyState, DispatchFn] {
  return useReducer(vaultonomyStateReducer, undefined, defaultVaultonomyState);
}

export function detectMetaMaskExtension({
  dispatch,
}: {
  dispatch: DispatchFn;
}) {
  let cancelled = false;
  async () => {
    const metaMaskExtensionId = await getMetaMaskExtensionId();
    if (metaMaskExtensionId && !cancelled) {
      dispatch({ type: "metaMaskDetected", metaMaskExtensionId });
    }
  };
  return () => {
    cancelled = true;
  };
}

export function VaultonomyRoot({
  wagmiConfigManager,
  children,
}: {
  wagmiConfigManager: WagmiConfigManager;
  children?: ReactNode;
}): JSX.Element {
  const [vaultonomy, dispatch] = useRootVaultonomyState();

  useEffect(() => detectMetaMaskExtension({ dispatch }), []);

  const configRequirements = new ConfigRequirements(
    vaultonomy.chosenWalletConnector,
    vaultonomy.metaMaskExtensionId
  );
  const wagmiConfig = wagmiConfigManager.getConfig(configRequirements);

  return (
    <WagmiConfig config={wagmiConfig}>
      <VaultonomyStateContext.Provider value={[vaultonomy, dispatch]}>
        {children}
      </VaultonomyStateContext.Provider>
    </WagmiConfig>
  );
}
