import { Emitter, createNanoEvents } from "nanoevents";

import { assert } from "../assert";
import { log as _log } from "../logging";
import { Unbind } from "../types";
import { browser } from "../webextension";
import { isRedditTab, redditTabUrlPatterns } from "./isReditTab";

const log = _log.getLogger("background/RedditTabObserver");

export type RedditTabObserverEvents = {
  availabilityChanged: (availability: Availability) => void;
  stopped: () => void;
};

type Availability = "available" | "unavailable";

// TODO logging

export class RedditTabObserver {
  readonly emitter: Emitter<RedditTabObserverEvents> = createNanoEvents();
  #stopObserving: Unbind | undefined = undefined;
  #lastAvailability: Availability | undefined;

  constructor() {}

  private observe(): Unbind {
    const availableTabs = new Set<number>();
    let hasFullSnapshot = false;
    const syncTab = (tab: chrome.tabs.Tab) => {
      if (isRedditTab(tab)) {
        if (!availableTabs.has(tab.id)) {
          log.debug(`tab became available`, tab);
          availableTabs.add(tab.id);
        }
      } else if (tab.id && availableTabs.has(tab.id)) {
        log.debug(`tab became unavailable`, tab);
        availableTabs.delete(tab.id);
      }
    };
    const removeTab = (id: number) => {
      if (availableTabs.has(id)) {
        log.debug(`available tab closed`, id);
        availableTabs.delete(id);
      }
    };

    let lastAvailability: Availability = "available";
    const reportAvailability = () => {
      if (!hasFullSnapshot) return;
      const availability: Availability =
        availableTabs.size === 0 ? "unavailable" : "available";
      if (availability !== lastAvailability) {
        lastAvailability = availability;
        log.debug(`reddit became ${availability}`);
        this.#lastAvailability = availability;
        this.emitter.emit("availabilityChanged", availability);
      }
    };

    const onTabUpdated = (
      _tabId: number,
      _tabChangeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab,
    ) => {
      log.debug("onTabUpdated", tab.status, tab.url, tab);
      syncTab(tab);
      reportAvailability();
    };

    const onTabRemoved = (
      tabId: number,
      _removeInfo: chrome.tabs.TabRemoveInfo,
    ) => {
      removeTab(tabId);
      reportAvailability();
    };

    browser.tabs.onUpdated.addListener(onTabUpdated);
    browser.tabs.onRemoved.addListener(onTabRemoved);

    (async () => {
      const tabs = await browser.tabs.query({ url: redditTabUrlPatterns() });
      tabs.forEach(syncTab);
      hasFullSnapshot = true;
      log.debug(`${availableTabs.size} tabs available at start`);
      reportAvailability();
    })().catch((e) => {
      log.error("RedditTabObserver encountered an error while observing:", e);
    });

    return () => {
      browser.tabs.onUpdated.removeListener(onTabUpdated);
      browser.tabs.onRemoved.removeListener(onTabRemoved);
    };
  }

  get isStarted(): boolean {
    return this.#stopObserving !== undefined;
  }

  get availability(): Promise<Availability> {
    if (this.#lastAvailability === undefined) {
      return new Promise((resolve, reject) => {
        const unbindAvailabilityChanged = this.emitter.on(
          "availabilityChanged",
          (availability) => {
            unbindAvailabilityChanged();
            unbindStopped();
            resolve(availability);
          },
        );
        const unbindStopped = this.emitter.on("stopped", () => {
          unbindAvailabilityChanged();
          unbindStopped();
          reject(
            new Error("RedditTabObserver stopped before availability known"),
          );
        });
      });
    }
    return Promise.resolve(this.#lastAvailability);
  }

  start(): void {
    if (this.isStarted) return;
    this.#stopObserving = this.observe();
  }

  stop(): void {
    if (!this.isStarted) return;
    assert(this.#stopObserving);
    this.#stopObserving();
    this.#stopObserving = undefined;
    this.#lastAvailability = undefined;
    this.emitter.emit("stopped");
  }
}
