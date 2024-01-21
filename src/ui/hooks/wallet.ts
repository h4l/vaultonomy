import { useQuery } from "@tanstack/react-query";
import { Connector, CreateConnectorFn, useConnectors } from "wagmi";

import { assert } from "../../assert";
import { useIsOnDevServer } from "../../devserver/isOnDevServer";
import { CROSS_EXTENSION_METAMASK_ID } from "../../ethereum/eip6963AnnounceCrossExtensionMetaMaskProvider";
import {
  WalletConnectorType,
  getCoinbaseWalletConnector,
  getWalletConnectConnector,
} from "../../wagmi";

function getMetaMaskConnector({
  connectors,
  isOnDevServer,
}: {
  connectors: readonly Connector[];
  isOnDevServer: boolean;
}): Connector | undefined {
  if (isOnDevServer) {
    // Dev server uses regular injected connector
    return connectors.find((c) => c.type === "injected");
  }
  return connectors.find((c) => c.id === CROSS_EXTENSION_METAMASK_ID);
}

function useMetaMaskLazyConnector(): LazyConnector {
  const isOnDevServer = useIsOnDevServer();
  const connectors = useConnectors();
  const connector = getMetaMaskConnector({ connectors, isOnDevServer });
  const available = useQuery<boolean>({
    queryFn: async () => !!(await connector?.getProvider()),
    queryKey: ["wallet-connector-available", connector?.id],
    enabled: !!connector,
  });
  const isAvailable = available.data === true;
  if (isAvailable) {
    assert(connector);
    return { isAvailable: true, getConnector: () => connector };
  }
  return { isAvailable: false };
}

export type LazyConnector =
  | { isAvailable: true; getConnector: () => Connector | CreateConnectorFn }
  | { isAvailable: false };
export type LazyConnectors = Record<WalletConnectorType, LazyConnector>;

export function useLazyConnectors(): LazyConnectors {
  return {
    [WalletConnectorType.MetaMask]: useMetaMaskLazyConnector(),
    [WalletConnectorType.Coinbase]: {
      isAvailable: true,
      getConnector: getCoinbaseWalletConnector,
    },
    [WalletConnectorType.WalletConnect]: {
      isAvailable: true,
      getConnector: getWalletConnectConnector,
    },
  };
}
