import { PortName } from "../PortName";
import { assert } from "../assert";
import { log as _log } from "../logging";
import {
  BackgroundServiceStartedEvent,
  InterestInUserEvent,
  UserLinkInteractionEvent,
} from "../messaging";
import { RedditProvider } from "../reddit/reddit-interaction-client";
import { AsyncConnector } from "../rpc/connections";
import { watchGlobalRedditTabScriptingPermission } from "../settings/PermissionsSettings";
import {
  VaultonomyUserPreferencesStore,
  createPreferencesStore,
} from "../settings/VaultonomySettings";
import { Stop } from "../types";
import {
  SettingsChangedEvent,
  TaggedVaultonomyBackgroundEvent,
  VAULTONOMY_RPC_PORT as VAULTONOMY_RPC_PORT_NAME,
} from "../vaultonomy-rpc-spec";
import { browser } from "../webextension";
import { retroactivePortDisconnection } from "../webextensions/retroactivePortDisconnection";
import {
  ActionContextMenu,
  bindActionContextMenuToSettingsStore,
} from "./ActionContextMenu";
import { EventLog } from "./EventLog";
import {
  InterestInUserFromUserPageViewObserver,
  UserPageTabActivatedEvent,
} from "./InterestInUserFromUserPageViewObserver";
import { RedditTabObserver } from "./RedditTabObserver";
import { VaultonomyBackgroundServiceSession } from "./VaultonomyBackgroundServiceSession";
import { handleCommandEvents } from "./commands";
import { redditTabUrlPatterns } from "./isReditTab";
import { startup } from "./startup";
import { redditTabConnector } from "./tab-connector";
import { DefaultRedditTabProvider } from "./tab-providers";

const log = _log.getLogger("background/BackgroundService");

type Disconnect = () => void;

export class BackgroundService {
  private readonly tabConnector: AsyncConnector<chrome.runtime.Port>;
  private readonly tabObserver: RedditTabObserver;
  private readonly actionContextMenu: ActionContextMenu;
  private readonly userPrefsStore: VaultonomyUserPreferencesStore;
  private readonly sessions: Set<VaultonomyBackgroundServiceSession> =
    new Set();
  private readonly notificationLog: EventLog<TaggedVaultonomyBackgroundEvent> =
    new EventLog((event) => event);
  protected toStop: Stop[] = [];

  constructor() {
    this.tabConnector = redditTabConnector(new DefaultRedditTabProvider());
    this.tabObserver = new RedditTabObserver();
    this.actionContextMenu = new ActionContextMenu();
    this.userPrefsStore = createPreferencesStore();
  }

  #isStarted: boolean = false;
  get isStarted(): boolean {
    return this.#isStarted;
  }

  /**
   * Attach event listeners, etc.
   *
   * start() must be called synchronously when the extension is started,
   * otherwise our action.onClicked handler won't be called for an initial
   * action click that starts our main function.
   */
  start(): void {
    if (this.#isStarted) return;
    this.#isStarted = true;
    const startTime = Date.now();

    this.toStop = [];

    this.toStop.push(this.startHandlingActionButtonClicks());
    this.toStop.push(this.startHandlingExtensionConnections());
    this.toStop.push(this.startNotifyInterestInUsersFromUserLinkInteraction());
    this.toStop.push(this.startNotifyInterestInUsersFromUserPageViews());
    this.toStop.push(this.startNotifySettingsChangedFromPrefsStoreChanged());
    this.toStop.push(
      this.startNotifyingSettingsChangedFromGlobalRedditPermissionsChange(),
    );
    this.toStop.push(this.ensureContentScriptsRunningAfterInstall());

    this.actionContextMenu.start();
    this.toStop.push(() => this.actionContextMenu.stop());
    this.userPrefsStore.start();
    this.toStop.push(() => this.userPrefsStore.stop());
    this.toStop.push(
      bindActionContextMenuToSettingsStore({
        contextMenu: this.actionContextMenu,
        settingsStore: this.userPrefsStore,
        sync: "from-settings",
      }),
    );

    this.tabObserver.start();
    this.toStop.push(handleCommandEvents({ userPrefs: this.userPrefsStore }));

    browser.runtime
      .sendMessage({
        type: "backgroundServiceStarted",
        startTime,
      } satisfies BackgroundServiceStartedEvent)
      .catch((e) => {
        // This happens when no browser.runtime.onMessage listeners are
        // registered, which happens when no UIs are open.
        if (
          /Could not establish connection|Receiving end does not exist/i.test(
            `${e}`,
          )
        ) {
          return;
        }
        log.warn("sendMessage failed", e);
      });
  }

  stop(): void {
    if (!this.#isStarted) return;
    this.#isStarted = false;

    for (const stop of this.toStop) stop();
    this.tabObserver.stop();
    for (const session of this.sessions) session.disconnect();

    // Note that tabConnector is stateless and doesn't need to be stopped.
  }

  /**
   * Listen for the extension being installed or updated and inject content scripts.
   *
   * We do this to make extension user interaction work right away in reddit
   * tabs. Normally a tab needs to be refreshed before the declarative content
   * scripts defined in our manifest.json get (re-)installed by the browser.
   */
  private ensureContentScriptsRunningAfterInstall(): Stop {
    const onInstalled = (_details: chrome.runtime.InstalledDetails): void => {
      this.injectUserInterestDetectionContentScriptInOpenRedditTabs().catch(
        (error): void => {
          log.error(
            "startHandlingUserInterestUserScriptInjection on extension install/update failed:",
            error,
          );
        },
      );
    };

    browser.runtime.onInstalled.addListener(onInstalled);

    return () => browser.runtime.onInstalled.removeListener(onInstalled);
  }

  private async injectUserInterestDetectionContentScriptInOpenRedditTabs(): Promise<void> {
    const results = await Promise.allSettled(
      (await browser.tabs.query({ url: redditTabUrlPatterns() })).map((tab) => {
        browser.scripting.executeScript({
          target: { tabId: tab.id! },
          files: ["reddit-detect-user-interest-contentscript.js"],
        });
      }),
    );

    const failed = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    if (failed.length > 0) {
      const cause = failed[0].reason;
      const msg = `injectUserInterestDetectionContentScriptInOpenRedditTabs failed to inject into ${failed.length}/${results.length} tabs`;
      log.error(msg, cause);
      throw new Error(msg, { cause });
    }
    log.info(
      `injectUserInterestDetectionContentScriptInOpenRedditTabs updated content script in ${results.length} tabs`,
    );
  }

  private notifySession(event: InterestInUserEvent | SettingsChangedEvent) {
    const eventContext = this.notificationLog.register(event);

    for (const session of this.sessions) {
      session.notifyInterestInUser(eventContext);
    }
  }

  private startNotifyInterestInUsersFromUserPageViews(): Stop {
    const observer = new InterestInUserFromUserPageViewObserver();

    const onUserPageTabActivated = ({
      username,
      startTime,
    }: UserPageTabActivatedEvent) => {
      this.notifySession({
        type: "userPageInteraction",
        username,
        startTime,
      });
    };

    const stopOnUserPageTabActivated = observer.emitter.on(
      "userPageTabActivated",
      onUserPageTabActivated,
    );

    observer.start();

    return () => {
      stopOnUserPageTabActivated();
      observer.stop();
    };
  }

  private startNotifyInterestInUsersFromUserLinkInteraction(): Stop {
    const onMessage = (
      message: unknown,
      sender: chrome.runtime.MessageSender,
      _sendResponse: (response?: unknown) => void,
    ): void => {
      const parsedMsg = UserLinkInteractionEvent.safeParse(message);

      if (parsedMsg.success) {
        const { type, username, startTime } = parsedMsg.data;
        log.debug(type, username, new Date(startTime), "sender:", sender);

        this.notifySession(parsedMsg.data);
      }
    };

    browser.runtime.onMessage.addListener(onMessage);

    return () => browser.runtime.onMessage.removeListener(onMessage);
  }

  private startNotifySettingsChangedFromPrefsStoreChanged(): Stop {
    // We don't need to notify what changed, we just re-fetch all settings.
    const onPropertiesChanged = (): void => {
      this.notifySession({ type: "settingsChanged" });
    };

    return this.userPrefsStore.emitter.on(
      "propertiesChanged",
      onPropertiesChanged,
    );
  }

  private startNotifyingSettingsChangedFromGlobalRedditPermissionsChange(): Stop {
    return watchGlobalRedditTabScriptingPermission((hasPermission) => {
      log.debug(
        "Global Reddit tab access",
        hasPermission ? "granted" : "revoked",
      );
      this.notifySession({ type: "settingsChanged" });
    });
  }

  private startHandlingExtensionConnections(): Stop {
    const onConnect = (port: chrome.runtime.Port) => {
      retroactivePortDisconnection.register(port);
      this.handleExtensionConnection(port);
    };

    browser.runtime.onConnect.addListener(onConnect);

    return () => browser.runtime.onConnect.removeListener(onConnect);
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

    const session = new VaultonomyBackgroundServiceSession({
      port,
      redditProvider,
      redditTabObserver: this.tabObserver,
      eventLog: this.notificationLog.events,
      userPrefsStore: this.userPrefsStore,
    });

    const disconnect = () => {
      log.debug(
        "Stopping Vaultonomy Background JSONRPC server/client for port",
        port,
      );
      this.sessions.delete(session);
      session.disconnect();
    };
    retroactivePortDisconnection.addRetroactiveDisconnectListener(
      port,
      disconnect,
    );

    this.sessions.add(session);
    return disconnect;
  }

  private startHandlingActionButtonClicks(): Stop {
    const onActionButtonClicked = (tab: chrome.tabs.Tab) => {
      log.trace("Action button clicked", new Date().toLocaleTimeString());
      // Opening the side panel be strictly synchronous, as we can only modify the
      // sidePanel from a user interaction event callback.
      this.ensureSidePanelIsOpenAndDisplayingVaultonomy(tab);
    };

    assert(!startup.startupFinished);
    browser.action.onClicked.addListener(onActionButtonClicked);

    return () => browser.action.onClicked.removeListener(onActionButtonClicked);
  }

  private ensureSidePanelIsOpenAndDisplayingVaultonomy(tab: chrome.tabs.Tab) {
    log.debug("Opening side panel");
    if (browser.sidebarAction) {
      browser.sidebarAction.toggle();
    }
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
    else if (browser.sidePanel) {
      browser.sidePanel.setOptions({
        enabled: true,
        path: "ui.html",
      });
      browser.sidePanel.open({ windowId: tab.windowId });
      // TODO: Chrome doesn't provide an API to close the panel. We can close it
      // by calling window.close() from the panel's environment.
    }
  }
}
