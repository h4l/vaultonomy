import { z } from "zod";

import { VaultonomyError } from "../VaultonomyError";
import { log as _log } from "../logging";
import { browser } from "../webextension";
import { isRedditTab } from "./isReditTab";

const log = _log.getLogger("background/tab-providers");

export type Unbind = () => void;

export class TabNotAvailable extends VaultonomyError {}

export interface TabProvider {
  getTab(): Promise<chrome.tabs.Tab>;
  unbind(): void;
}

/**
 * Provide access to the currently-active Reddit tab.
 *
 * This is a Reddit tab which was focussed when our action button was pressed,
 * if any. We have access to this tab thanks to the activeTab permission, even
 * if we don't have the host permission for reddit URLs.
 */
export class ActiveTabProvider implements TabProvider {
  private activeTab: chrome.tabs.Tab | undefined;

  constructor() {
    this.onActionClicked = this.onActionClicked.bind(this);
    browser.action.onClicked.addListener(this.onActionClicked);

    // Tab objects are a snapshot of tab state, not a live view. We stay up to
    // date by subscribing to changes, but we could instead re-fetch the tab in
    // getTab.
    this.onTabUpdated = this.onTabUpdated.bind(this);
    browser.tabs.onUpdated.addListener(this.onTabUpdated);

    // TODO: check if updated is enough to detect tabs closing, or if we need more events.
  }

  private onActionClicked(tab: chrome.tabs.Tab): void {
    if (!isRedditTab(tab)) return;

    this.activeTab = tab;
  }

  private onTabUpdated(
    tabId: number,
    _changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab,
  ): void {
    if (tabId !== this.activeTab?.id) return;
    this.activeTab = isRedditTab(tab) ? tab : undefined;
  }

  async getTab(): Promise<chrome.tabs.Tab> {
    if (this.activeTab) return this.activeTab;
    throw new TabNotAvailable("no active reddit tab");
  }

  unbind(): void {
    browser.action.onClicked.removeListener(this.onActionClicked);
    browser.tabs.onUpdated.removeListener(this.onTabUpdated);
    this.activeTab = undefined;
  }
}

export class GlobalRedditTabProvider implements TabProvider {
  async getTab(): Promise<chrome.tabs.Tab> {
    const [window, tabs] = await Promise.all([
      browser.windows.getCurrent(),
      browser.tabs.query({
        url: ["https://www.reddit.com/*", "https://new.reddit.com/*"],
      }),
    ]);

    // lower is better
    const statusScore = (tab: chrome.tabs.Tab): number =>
      tab.status === "complete" ? 0 : 1;
    const activeScore = (tab: chrome.tabs.Tab): number => (tab.active ? 0 : 1);
    const discardedScore = (tab: chrome.tabs.Tab): number =>
      tab.discarded ? 1 : 0;
    const currentWindowScore = (tab: chrome.tabs.Tab): number =>
      tab.windowId === window.id ? 0 : 1;
    const pinnedScore = (tab: chrome.tabs.Tab): number => (tab.pinned ? 0 : 1);

    // Rank the tabs so that we prefer using an available tab in the current
    // window to inject the content script into. Prefer pinned tabs as they're
    // less likely to be closed.
    tabs.sort(
      (a, b) =>
        discardedScore(a) - discardedScore(b) ||
        currentWindowScore(a) - currentWindowScore(b) ||
        statusScore(a) - statusScore(b) ||
        pinnedScore(a) - pinnedScore(b) ||
        activeScore(a) - activeScore(b),
    );

    if (tabs[0]) return tabs[0];
    throw new TabNotAvailable("no reddit tabs are open");
  }

  unbind(): void {}
}

const lastRedditTabStorageKey = "lastRedditTab";

export class PersistedRedditTabProvider implements TabProvider {
  // There's no point in holding the actual Tab instance, as it's a snapshot not
  // a live view.
  private tabId: number | null | undefined;
  #loadingTabId: Promise<number | null> | undefined;

  setTab(tabId: number): void {
    this.tabId = tabId;

    browser.storage.session
      .set({
        [lastRedditTabStorageKey]: tabId,
      })
      .catch((e) => {
        log.warn("failed to write tabId to session storage", e);
      });
  }

  private async loadTabId(): Promise<number | null> {
    const raw = (await browser.storage.session.get(lastRedditTabStorageKey))[
      lastRedditTabStorageKey
    ];
    return typeof raw === "number" && !isNaN(raw) ? raw : null;
  }

  async getTab(): Promise<chrome.tabs.Tab> {
    if (this.tabId === undefined) {
      if (this.#loadingTabId === undefined) {
        this.#loadingTabId = this.loadTabId().catch(() => null);
      }
      this.tabId = await this.#loadingTabId;
    }

    const tab =
      this.tabId === null ?
        null
      : await browser.tabs.get(this.tabId).catch(() => null);

    if (tab && isRedditTab(tab)) return tab;
    throw new TabNotAvailable("no persisted reddit tab available");
  }
  unbind(): void {}
}
