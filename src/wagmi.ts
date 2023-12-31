import {
  Config,
  Connector,
  configureChains,
  createConfig,
  mainnet,
} from "wagmi";
import { CoinbaseWalletConnector } from "wagmi/connectors/coinbaseWallet";
import { InjectedConnector } from "wagmi/connectors/injected";
import { MetaMaskConnector } from "wagmi/connectors/metaMask";
import { WalletConnectConnector } from "wagmi/connectors/walletConnect";
// import { alchemyProvider } from 'wagmi/providers/alchemy'
import { publicProvider } from "wagmi/providers/public";

import { assert, assertUnreachable } from "./assert";
import {
  ExternalExtensionConnector,
  hasWebExtensionConnectAPI,
} from "./ethereum/external-extension-connector";

// Configure chains & providers with the Alchemy provider.
// Two popular providers are Alchemy (alchemy.com) and Infura (infura.io)
const { chains, publicClient, webSocketPublicClient } = configureChains(
  [mainnet],
  [publicProvider()]
);

export enum WalletConnectorType {
  MetaMask = "MetaMask",
  Coinbase = "Coinbase",
  WalletConnect = "WalletConnect",
}

interface WalletConnectors {
  [WalletConnectorType.MetaMask]?:
    | MetaMaskConnector
    | ExternalExtensionConnector;
  [WalletConnectorType.Coinbase]?: CoinbaseWalletConnector;
  [WalletConnectorType.WalletConnect]?: WalletConnectConnector;
}

export class ConfigRequirements {
  constructor(
    public readonly walletConnector: WalletConnectorType | undefined,
    public readonly metaMaskExtensionId?: string
  ) {}
  equals(other?: ConfigRequirements): boolean {
    return (
      other !== undefined &&
      this.walletConnector === other.walletConnector &&
      this.metaMaskExtensionId === other.metaMaskExtensionId
    );
  }
}

class CreatedConfig {
  constructor(
    public readonly requirements: ConfigRequirements,
    public readonly config: Config
  ) {}
}

export class WagmiConfigManager {
  private initialisedConnectors: WalletConnectors = {};
  private createdConfig?: CreatedConfig;

  getConfig(requirements: ConfigRequirements): Config<any, any> {
    if (!this.createdConfig?.requirements.equals(requirements)) {
      this.createdConfig = new CreatedConfig(
        requirements,
        this.createConfig(requirements)
      );
    }
    return this.createdConfig.config;
  }

  private createMetaMaskConnector(
    extensionId?: string
  ): MetaMaskConnector | ExternalExtensionConnector | undefined {
    if (!hasWebExtensionConnectAPI()) {
      return new MetaMaskConnector({ chains });
    }

    if (!extensionId) return undefined;

    return new ExternalExtensionConnector({
      chains,
      options: { extensionTypeOrId: extensionId },
    });
  }

  private getConnectors(requirements: ConfigRequirements): Connector[] {
    if (!requirements.walletConnector) return [];

    if (!this.initialisedConnectors[requirements.walletConnector]) {
      switch (requirements.walletConnector) {
        case WalletConnectorType.MetaMask: {
          this.initialisedConnectors[WalletConnectorType.MetaMask] =
            this.createMetaMaskConnector();
        }
        case WalletConnectorType.Coinbase: {
          this.initialisedConnectors[WalletConnectorType.Coinbase] =
            new CoinbaseWalletConnector({
              chains,
              options: {
                appName: "Vaultonomy",
              },
            });
        }
        case WalletConnectorType.WalletConnect: {
          this.initialisedConnectors[WalletConnectorType.WalletConnect] =
            new WalletConnectConnector({
              chains,
              options: {
                projectId: "c32a495c2fa3b9068735d07e49d0a6f3",
              },
            });
        }
        default: {
          assert(
            false,
            `Unexpected walletConnector: ${requirements.walletConnector}`
          );
        }
      }
    }
    const connector = this.initialisedConnectors[requirements.walletConnector];
    return connector ? [connector] : [];
  }

  private createConfig(requirements: ConfigRequirements): Config<any, any> {
    return createConfig({
      autoConnect: false,
      connectors: this.getConnectors(requirements),
      publicClient,
      webSocketPublicClient,
    });
  }
}
