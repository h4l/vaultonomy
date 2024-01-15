import { Emitter, createNanoEvents } from "nanoevents";
import { z } from "zod";

import { assert } from "../assert";
import { log } from "../logging";
import {
  RedditTabBecameAvailableEvent,
  RedditTabBecameUnavailableEvent,
  RedditTabConnectionEvents,
  availabilityPortName,
} from "../messaging";
import { browser } from "../webextension";
import { isRedditTab } from "./isReditTab";

const ActiveRedditTab = z.object({ tabId: z.number() });
type ActiveRedditTab = z.infer<typeof ActiveRedditTab>;

const activeRedditTabStorageKey = "activeRedditTab";

interface ConnectedRedditTab {
  tab: chrome.tabs.Tab;
  port?: chrome.runtime.Port;
}

export class RedditTabConnection {
  private redditTab: ConnectedRedditTab | undefined;

  readonly emitter: Emitter<RedditTabConnectionEvents> = createNanoEvents();

  constructor(tab?: chrome.tabs.Tab) {
    if (tab) this.redditTab = { tab };
  }

  static async fromStoredState(): Promise<RedditTabConnection> {
    const activeTabInfo = await loadActiveRedditTab();
    if (activeTabInfo) {
      const activeTab = await browser.tabs.get(activeTabInfo.tabId);
      if (isRedditTab(activeTab)) {
        return new RedditTabConnection(activeTab);
      }
      log.debug(
        "Previously-active Reddit tab is no longer a Reddit tab, ignoring",
      );
    }
    return new RedditTabConnection();
  }

  isConnected(): boolean {
    return !!(
      this.redditTab &&
      isRedditTab(this.redditTab.tab) &&
      this.redditTab.port
    );
  }

  canReconnect(): boolean {
    return !!(this.redditTab && isRedditTab(this.redditTab.tab));
  }

  get connectedRedditTab(): chrome.tabs.Tab | undefined {
    return this.isConnected() ? this.redditTab?.tab : undefined;
  }

  get connectableRedditTab(): chrome.tabs.Tab | undefined {
    return this.canReconnect() ? this.redditTab?.tab : undefined;
  }

  handleAvailabilityConnection(port: chrome.runtime.Port): void {
    // Caller must only give us availability ports, as we disconnect ports if
    // we already have one.
    if (port.name !== availabilityPortName)
      throw new Error(`port is not named ${availabilityPortName}`);

    const tab = port.sender?.tab;
    assert(
      tab?.id !== undefined,
      "Port connected for availability without a sender.tab",
    );
    if (!isRedditTab(tab)) return;
    if (this.isConnected()) {
      log.warn(
        `Port connected for availability with a tab already available, closing new connection`,
      );
      port.disconnect();
      return;
    }
    log.debug("received availability connection from tab:", tab);
    this.redditTab = { tab, port };
    saveActiveRedditTab({ tabId: tab.id }).catch(log.error);

    this.requestAvailabilityEvent();

    port.onDisconnect.addListener((port) => {
      log.debug("availability port disconnected: ", {
        portTabUrl: port.sender?.tab?.url,
      });
      if (this.redditTab?.port === port) {
        // Assuming the page disconnected intentionally, we shouldn't
        // automatically re-connect when reloading state, so delete the
        // persisted reference to this tabId.
        saveActiveRedditTab(null).catch(log.error);
        const tabId = tab.id;
        this.redditTab = undefined;

        if (!tabId) {
          log.warn(
            "Tab associated with disconnected availability port has no tabId — not broadcasting disconnection",
          );
          return;
        }
        this.requestAvailabilityEvent();
      }
    });
  }

  requestAvailabilityEvent():
    | RedditTabBecameAvailableEvent
    | RedditTabBecameUnavailableEvent
    | undefined {
    const event = this.getCurrentAvailabilityEvent();
    if (!event) return;
    this.emitter.emit("availabilityStatus", event);
    return event;
  }

  protected getCurrentAvailabilityEvent():
    | RedditTabBecameAvailableEvent
    | RedditTabBecameUnavailableEvent
    | undefined {
    if (!this.redditTab?.tab.id) return undefined;
    return {
      type: this.isConnected()
        ? "redditTabBecameAvailable"
        : "redditTabBecameUnavailable",
      tabId: this.redditTab?.tab.id,
    };
  }
}

async function saveActiveRedditTab(
  activeRedditTab: ActiveRedditTab | null,
): Promise<void> {
  await browser.storage.session.set({
    [activeRedditTabStorageKey]: activeRedditTab,
  });
}

async function loadActiveRedditTab(): Promise<ActiveRedditTab | null> {
  const raw = (await browser.storage.session.get(activeRedditTabStorageKey))[
    activeRedditTabStorageKey
  ];
  const result = ActiveRedditTab.safeParse(raw);
  if (!result.success) {
    if (raw) {
      log.warn(
        `Invalid value persisted for ${activeRedditTabStorageKey}: ${result.error}`,
      );
    }
    return null;
  }
  return result.data;
}
