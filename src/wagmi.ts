import { getConfig } from "@wagmi/core";
import { UserRejectedRequestError } from "viem";
import {
  Config,
  Connector,
  configureChains,
  createConfig,
  mainnet,
} from "wagmi";
import { getAccount } from "wagmi/actions";
import { CoinbaseWalletConnector } from "wagmi/connectors/coinbaseWallet";
import { MetaMaskConnector } from "wagmi/connectors/metaMask";
import { WalletConnectConnector } from "wagmi/connectors/walletConnect";
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
  [publicProvider()],
);

export enum WalletConnectorType {
  MetaMask = "MetaMask",
  Coinbase = "Coinbase",
  WalletConnect = "WalletConnect",
}
export const walletConnectorTypes: ReadonlyArray<WalletConnectorType> = [
  WalletConnectorType.MetaMask,
  WalletConnectorType.Coinbase,
  WalletConnectorType.WalletConnect,
];

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
    public readonly metaMaskExtensionId?: string,
  ) {}
  equals(other?: ConfigRequirements): boolean {
    return (
      other !== undefined &&
      this.walletConnector === other.walletConnector &&
      this.metaMaskExtensionId === other.metaMaskExtensionId
    );
  }
}

function connectorIsOfType(
  connector: Connector,
  type: WalletConnectorType | undefined,
): boolean {
  switch (type) {
    case undefined:
      return false;
    case WalletConnectorType.MetaMask:
      return (
        connector.id === "metaMask" ||
        connector.id === "externalExtensionConnector"
      );
    case WalletConnectorType.Coinbase:
      return connector.id === "coinbaseWallet";
    case WalletConnectorType.WalletConnect:
      return connector.id === "walletConnect";
  }
}

class CreatedConfig {
  constructor(
    public readonly requirements: ConfigRequirements,
    public readonly config: Config,
  ) {}

  getRequiredConnector(): Connector | undefined {
    return this.config.connectors.find((c) =>
      connectorIsOfType(c, this.requirements.walletConnector),
    );
  }
}

function getAccountIfConfigured() {
  // getAccount() throws if wagmi is not configured
  try {
    return getAccount();
  } catch (e) {
    return undefined;
  }
}

// TODO: WagmiConfigUpdater?
export class WagmiConfigManager {
  private initialisedConnectors: WalletConnectors = {};
  private createdConfig?: CreatedConfig;

  get current(): CreatedConfig | undefined {
    return this.createdConfig;
  }

  isConfigConnected(): boolean {
    return getAccountIfConfigured()?.isConnected ?? false;
  }

  applyRequirements(requirements: ConfigRequirements): {
    changed: boolean;
    current: CreatedConfig;
  } {
    let changed = false;
    if (!this.createdConfig?.requirements.equals(requirements)) {
      if (this.isConfigConnected()) {
        throw new Error(
          "Cannot replace wagmi config while a Connector is connected",
        );
      }

      this.createdConfig = new CreatedConfig(
        requirements,
        this.createConfig(requirements),
      );
      changed = true;
    }
    return { changed, current: this.createdConfig };
  }

  isConnectorUsable(connectorType: WalletConnectorType): boolean {
    if (connectorType === WalletConnectorType.MetaMask) {
      // In dev mode (running as a regular web page, not extension) MM is
      // available if the connector reports being ready (i.e. it detected MM).
      // In prod mode, the connector is only created if the MM extension is
      // detected.
      return (
        this.initialisedConnectors[WalletConnectorType.MetaMask]?.ready ?? false
      );
    }
    // Coinbase and WalletConnect are always available for use
    return true;
  }

  private createMetaMaskConnector(
    extensionId?: string,
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
    // Always attempt to create MetaMask, as it doesn't make external
    // requests, and we need to know if it's available (the others always are).
    if (!this.initialisedConnectors[WalletConnectorType.MetaMask]) {
      this.initialisedConnectors[WalletConnectorType.MetaMask] =
        this.createMetaMaskConnector();
    }

    if (!requirements.walletConnector) return [];

    if (!this.initialisedConnectors[requirements.walletConnector]) {
      switch (requirements.walletConnector) {
        case WalletConnectorType.MetaMask: {
          this.initialisedConnectors[WalletConnectorType.MetaMask] =
            this.createMetaMaskConnector();
          break;
        }
        case WalletConnectorType.Coinbase: {
          this.initialisedConnectors[WalletConnectorType.Coinbase] =
            new CoinbaseWalletConnector({
              chains,
              options: {
                appName: "Vaultonomy",
              },
            });
          break;
        }
        case WalletConnectorType.WalletConnect: {
          this.initialisedConnectors[WalletConnectorType.WalletConnect] =
            new WalletConnectConnector({
              chains,
              options: {
                projectId: "c32a495c2fa3b9068735d07e49d0a6f3",
              },
            });
          break;
        }
        default: {
          assertUnreachable(requirements.walletConnector);
        }
      }
    }
    const connector = this.initialisedConnectors[requirements.walletConnector];
    return connector ? [connector] : [];
  }

  private createConfig(requirements: ConfigRequirements): Config<any, any> {
    const config = createConfig({
      autoConnect: false,
      connectors: this.getConnectors(requirements),
      publicClient,
      webSocketPublicClient,
    });
    const setConfig = getConfig();
    assert(Object.is(config, setConfig));
    return config;
  }
}

// https://github.com/WalletConnect/walletconnect-monorepo/commit/6b0931e4f9e38cbe5b7c8b2bf679d89021bd97fc#diff-0afa19560917fc59dfab1cf6bd7c1f7763161ed201b94ab806033002adb0115bR251
const walletConnectProviderConnectUserCancelErrorMessage =
  "Connection request reset. Please try again.";

export function isUserRejectedRequestError(_error: unknown): boolean {
  // wagmi's Connectors try to detect user-cancellation and throw
  // UserRejectedRequestError, but the Coinbase and WalletConnect Connectors
  // don't succeed currently, so user cancels are treated as actual errors by
  // default.
  const error = _error as { code?: unknown; message?: unknown };
  return (
    error.code === UserRejectedRequestError.code ||
    error.message === walletConnectProviderConnectUserCancelErrorMessage
  );
}
