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
type AvailabilityState = {
  lastAvailability: Promise<Availability> | Availability;
  stop: Unbind;
};

/**
 * Monitor the number of open Reddit tabs available to us, to determine whether
 * it's currently possible to run our content script to communicate with Reddit.
 */
export class RedditTabObserver {
  readonly emitter: Emitter<RedditTabObserverEvents> = createNanoEvents();
  #state: AvailabilityState | undefined;

  private observe(): AvailabilityState {
    let state: (AvailabilityState & { hasFullSnapshot: boolean }) | undefined;
    const availableTabs = new Set<number>();

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

    const reportAvailability = (): Availability | undefined => {
      if (!state?.hasFullSnapshot) return;
      const availability: Availability =
        availableTabs.size === 0 ? "unavailable" : "available";
      if (availability !== state.lastAvailability) {
        state.lastAvailability = availability;
        log.debug(`reddit became ${availability}`);
        if (this.#state !== state) {
          log.warn("reportAvailability() called while not current");
          return;
        }
        this.emitter.emit("availabilityChanged", availability);
      }
      return availability;
    };

    const onTabUpdated = (
      _tabId: number,
      _tabChangeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab,
    ) => {
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

    state = {
      hasFullSnapshot: false,
      lastAvailability: (async () => {
        const tabs = await browser.tabs.query({ url: redditTabUrlPatterns() });
        tabs.forEach(syncTab);
        assert(state);
        state.hasFullSnapshot = true;
        log.debug(`${availableTabs.size} tabs available at start`);
        const availability = reportAvailability();

        assert(availability);
        return availability;
      })(),

      stop: () => {
        browser.tabs.onUpdated.removeListener(onTabUpdated);
        browser.tabs.onRemoved.removeListener(onTabRemoved);
      },
    };
    return state;
  }

  get isStarted(): boolean {
    return this.#state !== undefined;
  }

  get availability(): Promise<Availability> {
    if (!this.#state) throw new Error("stopped");
    return Promise.resolve(this.#state.lastAvailability);
  }

  start(): void {
    if (this.#state) return;
    this.#state = this.observe();
  }

  stop(): void {
    if (!this.#state) return;
    this.#state.stop();
    this.#state = undefined;
    this.emitter.emit("stopped");
  }
}
