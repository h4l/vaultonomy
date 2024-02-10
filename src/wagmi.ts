import { CreateConnectorFn, createConfig, http } from "wagmi";
import { mainnet, optimism } from "wagmi/chains";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";

export enum WalletConnectorType {
  MetaMask = "MetaMask",
  Coinbase = "Coinbase",
  WalletConnect = "WalletConnect",
}

// window.ethereum is only available in dev mode, where the UI is a web page
// from the dev server. In the extension we use EIP-6963 to inject a
// cross-extension MetaMask provider. Wagmi detects it automatically.
const devModeInjectedConnector = injected();

export const wagmiConfig = createConfig({
  chains: [mainnet, optimism],
  transports: {
    [mainnet.id]: http(),
    [optimism.id]: http(),
  },
  connectors: [
    devModeInjectedConnector,
    // connectors are created on-demand
  ],
  // TODO configure storage? Maybe at Tanstack Query level?
});

let coinbaseWalletConnectorFn: CreateConnectorFn | undefined;

export function getCoinbaseWalletConnector(): CreateConnectorFn {
  if (!coinbaseWalletConnectorFn) {
    coinbaseWalletConnectorFn = coinbaseWallet({
      appName: "Vaultonomy",
      // Show the QR modal when a mobile browser is detected. By default it
      // opens a mobile intent URL, which doesn't work for an extension. This
      // only really matters for dev mode using dev tools' mobile view.
      enableMobileWalletLink: true,
    });
  }
  return coinbaseWalletConnectorFn;
}

let walletConnectConnectorFn: CreateConnectorFn | undefined;

export function getWalletConnectConnector(): CreateConnectorFn {
  if (!walletConnectConnectorFn) {
    walletConnectConnectorFn = walletConnect({
      projectId: "c32a495c2fa3b9068735d07e49d0a6f3",
    });
  }
  return walletConnectConnectorFn;
}
