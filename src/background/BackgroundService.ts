import { PortName } from "../PortName";
import { log as _log } from "../logging";
import { RedditProvider } from "../reddit/reddit-interaction-client";
import { AsyncConnector } from "../rpc/connections";
import { VAULTONOMY_RPC_PORT as VAULTONOMY_RPC_PORT_NAME } from "../vaultonomy-rpc-spec";
import { browser } from "../webextension";
import { retroactivePortDisconnection } from "../webextensions/retroactivePortDisconnection";
import { RedditTabObserver } from "./RedditTabObserver";
import { VaultonomyBackgroundServiceSession } from "./VaultonomyBackgroundServiceSession";
import { redditTabConnector } from "./tab-connector";
import { DefaultRedditTabProvider } from "./tab-providers";

const log = _log.getLogger("background/BackgroundService");

type Disconnect = () => void;

export class BackgroundService {
  private readonly tabConnector: AsyncConnector<chrome.runtime.Port>;
  private readonly tabObserver: RedditTabObserver;

  constructor() {
    this.handleExtensionConnection = this.handleExtensionConnection.bind(this);
    this.handleActionButtonClick = this.handleActionButtonClick.bind(this);

    this.tabConnector = redditTabConnector(new DefaultRedditTabProvider());

    // We must register action.onClicked synchronously, otherwise our handler
    // won't be called for an initial action click that starts our main
    // function.
    browser.action.onClicked.addListener(this.handleActionButtonClick);
    browser.runtime.onConnect.addListener((port) => {
      retroactivePortDisconnection.register(port);
      this.handleExtensionConnection(port);
    });

    this.tabObserver = new RedditTabObserver();
    this.tabObserver.start();
  }

  protected handleExtensionConnection(port: chrome.runtime.Port) {
    switch (PortName.parse(port.name).base) {
      case VAULTONOMY_RPC_PORT_NAME.base:
        this.setUpBackgroundServiceSession(port);
        break;
      default:
        log.debug("Ignored connection for unexpected Port name", port);
        break;
    }
  }

  protected setUpBackgroundServiceSession(
    port: chrome.runtime.Port,
  ): Disconnect {
    log.debug(
      "Starting Vaultonomy Background JSONRPC server/client for port",
      port,
    );
    // We could share one provider across multiple connections. I'm leaning
    // towards one per connection though for a few reasons. Mostly there will be
    // just one active connection. (Sidebars in multiple windows could open > 1,
    // or multiple dev server instances). But the setup cost should be very low,
    // and creating a new one on each connection should make things more robust,
    // as each connection will be regularly torn down and any screw up in a
    // single connection won't affect others. And the Reddit tab can know right
    // away if it has 0 clients.
    const redditProvider = RedditProvider.fromAsyncPortConnector(
      this.tabConnector,
    );

    const session = new VaultonomyBackgroundServiceSession(
      port,
      redditProvider,
      this.tabObserver,
    );

    const disconnect = () => {
      log.debug(
        "Stopping Vaultonomy Background JSONRPC server/client for port",
        port,
      );
      session.disconnect();
    };
    retroactivePortDisconnection.addRetroactiveDisconnectListener(
      port,
      disconnect,
    );

    return disconnect;
  }

  handleActionButtonClick(tab: chrome.tabs.Tab) {
    log.trace("handleActionButtonClick()", new Date().toLocaleTimeString());
    // Opening the side panel be strictly synchronous, as we can only modify the
    // sidePanel from a user interaction event callback.
    this.ensureSidePanelIsOpenAndDisplayingVaultonomy(tab);
  }

  ensureSidePanelIsOpenAndDisplayingVaultonomy(tab: chrome.tabs.Tab) {
    log.debug("Opening side panel");
    // Enable our page in the side panel for the whole current window, not just
    // the current tab. So our page remains open when changing tabs. Users can
    // close the side panel, or open a different side-panel page and re-open our
    // page later by triggering this again by clicking our Action button.
    //
    // We could open just on the current tab, but it seems useful to be able to
    // view our sidepanel while viewing a different website, e.g. to follow
    // instructions. And opening on a single tab would result in multiple
    // instances being open on different tabs, each with their own state. That
    // would surely be confusing.
    chrome.sidePanel.setOptions({
      enabled: true,
      path: "ui.html",
    });
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
}
