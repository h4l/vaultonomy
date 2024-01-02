import {
  StreamProvider,
  createExternalExtensionProvider,
} from "@metamask/providers";
import {
  InjectedConnector,
  InjectedConnectorOptions,
} from "@wagmi/connectors/injected";
import { Chain, WindowProvider } from "wagmi";

export interface ExternalExtensionConnectorOptions {
  /**
   * The Wallet extension to connect to.
   *
   * The aliases "stable", "flask", "beta" resolve to the corresponding MetaMask
   * versions on Chrome or Firefox. Otherwise, the value is a browser-specific
   * extension ID that defines the wallet extension to connect to.
   *
   * @see https://github.com/MetaMask/providers/blob/126a8c868785eb088511769cd532a72072662369/src/extension-provider/createExternalExtensionProvider.ts#L13
   */
  extensionTypeOrId?: "stable" | "flask" | "beta" | string;
  name?: string;
}

function getExtensionName(extensionTypeOrId: string): string {
  return (
    { stable: "MetaMask", flask: "MetaMask Flask", beta: "MetaMask Beta" }[
      extensionTypeOrId
    ] ?? `Unknown Browser Extension ${JSON.stringify(extensionTypeOrId)}`
  );
}

export function hasWebExtensionConnectAPI(): boolean {
  return (
    chrome && chrome.runtime && typeof chrome.runtime.connect === "function"
  );
}

/**
 * A wagmi Connector that connects to MetaMask via cross-extension messaging.
 *
 * This Connector allows one browser extension to connect to MetaMask directly,
 * without using the conventional window.ethereum global provider.
 *
 * At a high level, this works in a similar way to a normal MetaMask wallet
 * connection from a web page. Normally, the MetaMask extension has access to a
 * page via a contentscript and it creates a Provider object on the
 * window.ethereum global that connects to its own extension via a web extension
 * Port. Because one browser extension can't reach into another, we can't rely
 * on MetaMask having created window.ethereum in our environment, so instead we
 * create the Provider object ourselves, opening a cross-extension Port to the
 * MetaMask extension. The @metamask/providers package provides a function that
 * creates this Provider.
 *
 * In principle, it can connect to wallets other than MetaMask if they also
 * accept cross-extension connections via chrome.runtime.onConnectExternal:
 * https://developer.chrome.com/docs/extensions/reference/api/runtime#event-onConnectExternal
 */
export class ExternalExtensionConnector extends InjectedConnector {
  readonly id: string = "externalExtensionConnector";
  readonly ready: boolean = true;
  #extensionTypeOrId: string;
  #provider?: StreamProvider;

  constructor({
    chains,
    options: options_,
  }: {
    chains?: Chain[];
    options?: ExternalExtensionConnectorOptions;
  } = {}) {
    const extensionTypeOrId = options_?.extensionTypeOrId ?? "stable";
    const name = options_?.name ?? getExtensionName(extensionTypeOrId);
    // The superclass calls options.getProvider() in its constructor, which
    // means the function we provide there cannot access `this` from our
    // constructor context. This is rather limiting, so instead we pass a
    // function that returns undefined, and override the class's getProvider()
    // method.
    const options: InjectedConnectorOptions = {
      name,
      shimDisconnect: false,
      getProvider: () => undefined,
    };
    super({ chains, options });
    if (!hasWebExtensionConnectAPI()) {
      console.warn(
        "ExternalExtensionConnector is not available as this environment lacks chrome.runtime.connect()",
      );
      this.ready = false;
    } else {
      this.ready = true;
    }
    this.#extensionTypeOrId = extensionTypeOrId;
  }

  async getProvider(): Promise<WindowProvider | undefined> {
    // The StreamProvider is an EIP1193Provider, but doesn't have the isMetamask
    // property or other internal quirks WindowProvider has:
    // https://github.com/wevm/wagmi/blob/c83f9b8b67dd2bd20c58d13f41f7d0aee23e5b7a/packages/connectors/src/types.ts#L65
    // However these additional properties aren't used by our superclass in
    // practice, so we can tell a white lie about the type.
    console.log("ExternalExtensionConnector.options.getProvider()");
    return this.#getOrCreateProvider() as unknown as WindowProvider;
  }

  #getOrCreateProvider(): StreamProvider {
    if (!this.#provider) {
      const provider = createExternalExtensionProvider(this.#extensionTypeOrId);
      // Browser extension Ports can't reconnect, so we need to re-create the
      // provider if it becomes disconnected.
      provider.on("disconnect", () => {
        if (this.#provider === provider) this.#provider = undefined;
      });
      this.#provider = provider;
    }
    return this.#provider;
  }
}
