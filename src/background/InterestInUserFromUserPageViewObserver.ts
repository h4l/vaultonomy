import { Emitter, createNanoEvents } from "nanoevents";

import { assert } from "../assert";
import { log } from "../logging";
import { Stop } from "../types";
import { browser } from "../webextension";

const userPageUrlPattern =
  /^(?:https?:\/\/(?:(?:new|old|www)\.)?reddit.com\/)?u(?:ser)?\/(?<name>[\w-]{1,20})\/*$/i;

type UserPageTab = {
  tabId: number;
  windowId: number;
  username: string;
};

type CachedUserPageTab = UserPageTab & { url: string };

export type UserPageTabActivatedEvent = UserPageTab & { startTime: number };

function parseUserPageTab(tab: chrome.tabs.Tab): CachedUserPageTab | undefined {
  if (tab.id === undefined || !tab.url) return;

  const userPageUrl = userPageUrlPattern.exec(tab.url);
  if (!userPageUrl) return;

  const username = userPageUrl?.groups?.["name"];
  assert(username);
  return { tabId: tab.id, windowId: tab.windowId, url: tab.url, username };
}

/**
 * Infer user interest in another user by noticing when they view a tab for a
 * Reddit user's page. (The UI uses this to automatically show details of the
 * user shown interest in.)
 */
export class InterestInUserFromUserPageViewObserver {
  emitter: Emitter<{
    userPageTabActivated: (event: UserPageTabActivatedEvent) => void;
  }> = createNanoEvents();

  constructor() {}

  get isStarted(): boolean {
    return !!this.#stop;
  }

  #stop: Stop | undefined;
  start(): void {
    if (this.#stop) return;

    let userPageTabs: Map<number, CachedUserPageTab> | undefined = undefined;

    function getUserPageTab(
      tab: chrome.tabs.Tab,
    ): CachedUserPageTab | undefined {
      if (tab.id === undefined) return;
      const existing = userPageTabs?.get(tab.id);
      if (
        existing &&
        tab.url === existing.url &&
        existing.windowId === tab.windowId
      ) {
        return existing;
      }

      return parseUserPageTab(tab);
    }

    const emitUserPageTabActivated = (userPageTab: CachedUserPageTab) => {
      log.debug("userPageTabActivated", userPageTab);
      const { tabId, windowId, username } = userPageTab;
      this.emitter.emit("userPageTabActivated", {
        tabId,
        windowId,
        username,
        startTime: Date.now(),
      });
    };

    browser.tabs.query({ url: "https://*.reddit.com/*" }).then((tabs) => {
      userPageTabs = new Map();

      for (const tab of tabs) {
        const userPageTab = parseUserPageTab(tab);
        if (userPageTab) userPageTabs.set(userPageTab.tabId, userPageTab);
      }
    });

    const onTabActivated = (activeInfo: chrome.tabs.TabActiveInfo) => {
      if (!userPageTabs) return;

      const userPageTab = userPageTabs.get(activeInfo.tabId);
      if (!userPageTab) return;

      emitUserPageTabActivated(userPageTab);
    };

    const onTabUpdatedOrRemoved = (
      tabId: number,
      _ignored?: unknown,
      tab?: chrome.tabs.Tab,
    ): void => {
      if (!userPageTabs) return;

      const oldUserPageTab = userPageTabs.get(tabId);
      const newUserPageTab = tab ? getUserPageTab(tab) : undefined;

      let outcome: "deleted" | "created" | "updated" | "ignored" = "ignored";
      if (!newUserPageTab && oldUserPageTab) {
        outcome = "deleted";

        userPageTabs!.delete(tabId);
      } else if (newUserPageTab && newUserPageTab !== oldUserPageTab) {
        outcome = oldUserPageTab ? "updated" : "created";
        userPageTabs.set(tabId, newUserPageTab);
      }

      if (outcome !== "ignored")
        log.debug(
          outcome,
          "user page tab from:",
          oldUserPageTab,
          ", to:",
          newUserPageTab,
        );

      if (tab?.active && newUserPageTab && oldUserPageTab !== newUserPageTab) {
        emitUserPageTabActivated(newUserPageTab);
      }
    };

    browser.tabs.onActivated.addListener(onTabActivated);
    browser.tabs.onRemoved.addListener(onTabUpdatedOrRemoved);
    browser.tabs.onUpdated.addListener(onTabUpdatedOrRemoved);

    this.#stop = () => {
      browser.tabs.onActivated.removeListener(onTabActivated);
      browser.tabs.onRemoved.removeListener(onTabUpdatedOrRemoved);
      browser.tabs.onUpdated.removeListener(onTabUpdatedOrRemoved);
    };
  }

  stop(): void {
    if (!this.#stop) return;
    this.#stop();
    this.#stop = undefined;
  }
}
