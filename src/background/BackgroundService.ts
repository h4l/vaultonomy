import { PortName } from "../PortName";
import { assert, assertUnreachable } from "../assert";
import { log } from "../logging";
import { AVAILABILITY_PORT_NAME } from "../messaging";
import { RedditProvider } from "../reddit/reddit-interaction-client";
import { REDDIT_INTERACTION_PORT_NAME } from "../reddit/reddit-interaction-spec";
import { VAULTONOMY_RPC_PORT as VAULTONOMY_RPC_PORT_NAME } from "../vaultonomy-rpc-spec";
import { browser } from "../webextension";
import { createContentScriptPortConnector } from "../webextensions/port-connections";
import { retroactivePortDisconnection } from "../webextensions/retroactivePortDisconnection";
import { RedditTabConnection } from "./RedditTabConnection";
import { VaultonomyBackgroundServiceSession } from "./VaultonomyBackgroundServiceSession";
import { isRedditTab } from "./isReditTab";

type ErrorTabConnectionResult = {
  type: "error";
  reason: string;
  tab: chrome.tabs.Tab;
};
type TabConnectionResult =
  | { type: "already-connected"; tab: chrome.tabs.Tab }
  | {
      type: "now-connecting";
      which: "foreground" | "previously-active";
      tab: chrome.tabs.Tab;
    }
  | { type: "not-reddit"; tab: chrome.tabs.Tab }
  | ErrorTabConnectionResult;

type Disconnect = () => void;

export class BackgroundService {
  #asyncState: Promise<RedditTabConnection> | undefined;

  protected get redditTabConnection(): Promise<RedditTabConnection> {
    if (this.#asyncState === undefined) {
      throw new Error("init not called");
    }
    return this.#asyncState;
  }

  constructor() {
    this.handleExtensionConnection = this.handleExtensionConnection.bind(this);
    this.handleActionButtonClick = this.handleActionButtonClick.bind(this);
  }

  /**
   * Register event handlers and start loading async state.
   *
   * Must be called before other methods are called.
   */
  init(): Promise<void> {
    // We need to do sync and async work, but always return a Promise for
    // consistency.
    try {
      this.initSync();
    } catch (error) {
      return Promise.reject(error);
    }
    return this.initAsync();
  }

  protected initSync() {
    if (this.#asyncState) throw new Error("init already called");
    this.#asyncState = RedditTabConnection.fromStoredState();

    // We must register action.onClicked synchronously, otherwise our handler
    // won't be called for an initial action click that starts our main
    // function.
    browser.action.onClicked.addListener(this.handleActionButtonClick);
    browser.runtime.onConnect.addListener((port) => {
      retroactivePortDisconnection.register(port);
      this.handleExtensionConnection(port).catch(log.error);
    });
  }

  protected async initAsync(): Promise<void> {
    await this.#asyncState;
  }

  async handleExtensionConnection(port: chrome.runtime.Port) {
    switch (PortName.parse(port.name).base) {
      case VAULTONOMY_RPC_PORT_NAME.base:
        this.setUpBackgroundServiceSession(
          port,
          await this.redditTabConnection,
        );
        break;
      case AVAILABILITY_PORT_NAME.base:
        (await this.redditTabConnection).handleAvailabilityConnection(port);
        break;
      default:
        log.debug("Ignored connection for unexpected Port name", port);
        break;
    }
  }

  protected setUpBackgroundServiceSession(
    port: chrome.runtime.Port,
    redditTabConnection: RedditTabConnection,
  ): Disconnect {
    log.debug(
      "Starting Vaultonomy Background JSONRPC server/client for port",
      port,
    );
    const session = new VaultonomyBackgroundServiceSession(port);

    let currentRedditProvider:
      | { tabId: number; redditProvider: RedditProvider }
      | undefined;

    const unbindAvailabilityStatus = redditTabConnection.emitter.on(
      "availabilityStatus",
      (event) => {
        switch (event.type) {
          case "redditTabBecameAvailable":
            // Don't re-create connections for the same tabId
            if (currentRedditProvider?.tabId === event.tabId) return;
            currentRedditProvider?.redditProvider.emitter.emit(
              "disconnectSelf",
            );
            currentRedditProvider = {
              tabId: event.tabId,
              redditProvider: RedditProvider.from(
                createContentScriptPortConnector({
                  tabId: event.tabId,
                  portName: REDDIT_INTERACTION_PORT_NAME,
                }),
              ),
            };
            currentRedditProvider.redditProvider.emitter.on(
              "disconnected",
              () => {
                currentRedditProvider = undefined;
              },
            );

            session.setRedditProvider(currentRedditProvider.redditProvider);
            break;
          case "redditTabBecameUnavailable":
            currentRedditProvider = undefined;
            session.setRedditProvider(undefined);
            break;
          default:
            assertUnreachable(event);
        }
      },
    );

    const disconnect = () => {
      log.debug(
        "Stopping Vaultonomy Background JSONRPC server/client for port",
        port,
      );
      unbindAvailabilityStatus();
      session.disconnect();
    };
    retroactivePortDisconnection.addRetroactiveDisconnectListener(
      port,
      disconnect,
    );
    setTimeout(() => redditTabConnection.requestAvailabilityEvent());

    return disconnect;
  }

  handleActionButtonClick(tab: chrome.tabs.Tab) {
    log.trace("handleActionButtonClick()", new Date().toLocaleTimeString());
    // Opening the side panel be strictly synchronous, as we can only modify the
    // sidePanel from a user interaction event callback.
    this.ensureSidePanelIsOpenAndDisplayingVaultonomy(tab);

    (async () => {
      const result = await this.reConnectToActiveTabOrCurrentTab(tab);

      const context = "Vaultonomy action button clicked:";
      switch (result.type) {
        case "already-connected":
          log.debug(context, "Already connected to a Reddit tab.", result.tab);
          break;
        case "now-connecting":
          log.debug(
            context,
            `Started connecting to ${result.which} Reddit tab.`,
            result.tab,
          );
          break;
        case "not-reddit":
          log.debug(
            context,
            "Foreground tab is not Reddit, cannot connect.",
            result.tab,
          );
          break;
        case "error":
          log.error(
            context,
            "Could not connect to tab:",
            result.reason,
            result.tab,
          );
          break;
        default:
          assertUnreachable(result);
      }
    })().catch(console.error);
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

  // TODO: when restoring, we should connect to the foreground tab if it's a
  // reddit tab, otherwise use the old one. Although, this would disconnect ongoing
  // actions. Should we focus the current reddit tab instead?
  private async reConnectToActiveTabOrCurrentTab(
    foregroundTab: chrome.tabs.Tab,
  ): Promise<TabConnectionResult> {
    // Clicking the action button can wake up this service worker after it was
    // shut down. If we were connected to a Reddit tab before, we re-use that tab
    // rather than connecting to the current tab.
    // const activeTabInfo = await loadActiveRedditTab();
    const existingRedditTabConnection = await this.redditTabConnection;

    // Don't disconnect and reconnect, as doing so would break ongoing requests
    const connectedRedditTab = existingRedditTabConnection.connectedRedditTab;
    if (connectedRedditTab) {
      return { type: "already-connected", tab: connectedRedditTab };
    }

    // Prefer to connect to the visible tab if it's Reddit
    if (isRedditTab(foregroundTab)) {
      const error = await this.tryToConnectToTab(foregroundTab);
      return (
        error || {
          type: "now-connecting",
          which: "foreground",
          tab: foregroundTab,
        }
      );
    }

    // Otherwise if the previously-active-but-disconnected tab is still Reddit,
    // connect to that.
    const existingRedditTab = existingRedditTabConnection.connectableRedditTab;
    if (existingRedditTab) {
      const error = await this.tryToConnectToTab(existingRedditTab);
      return (
        error || {
          type: "now-connecting",
          which: "previously-active",
          tab: existingRedditTab,
        }
      );
    }

    return { type: "not-reddit", tab: foregroundTab };
  }

  private async tryToConnectToTab(
    activeTab: chrome.tabs.Tab,
  ): Promise<ErrorTabConnectionResult | undefined> {
    assert(isRedditTab(activeTab));

    if (!activeTab.id) {
      return {
        type: "error",
        reason: "Active tab has no id — ignoring.",
        tab: activeTab,
      };
    }
    try {
      console.log("Running Vaultonomy's reddit client in active Reddit tab.");
      await browser.scripting.executeScript({
        target: { tabId: activeTab.id },
        // TODO: can we re-introduce the function loading method?
        // func: loadReddit,
        files: ["reddit-contentscript.js"],
      });
    } catch (e) {
      return {
        type: "error",
        reason: `Failed to execute content script in reddit tab: ${e}`,
        tab: activeTab,
      };
    }
  }
}
