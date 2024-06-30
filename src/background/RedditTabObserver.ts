import { Emitter, createNanoEvents } from "nanoevents";

import { assert } from "../assert";
import { log as _log } from "../logging";
import { Stop, Unbind } from "../types";
import { browser } from "../webextension";
import { isRedditTab, redditTabUrlPatterns } from "./isReditTab";
import { startup } from "./startup";

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
    const state: Partial<AvailabilityState> & {
      isReloading: boolean;
      isStopped: boolean;
    } = {
      isReloading: false,
      isStopped: false,
    };
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

    const reloadTabs = async (triggerName: string) => {
      if (state.isReloading) return;
      state.isReloading = true;

      try {
        const tabs = await browser.tabs.query({ url: redditTabUrlPatterns() });
        availableTabs.clear();
        tabs.forEach(syncTab);
        log.debug(`${availableTabs.size} tabs available at ${triggerName}`);
      } finally {
        state.isReloading = false;
      }
    };

    const reportAvailability = (): Availability | undefined => {
      if (state.isReloading || state.isStopped) return;
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

    const toStop: Stop[] = [];

    browser.tabs.onUpdated.addListener(onTabUpdated);
    toStop.push(() => browser.tabs.onUpdated.removeListener(onTabUpdated));

    browser.tabs.onRemoved.addListener(onTabRemoved);
    toStop.push(() => browser.tabs.onRemoved.removeListener(onTabRemoved));

    // When the action button is clicked, we may gain access to the tab if the
    // user has disabled automatic host access to reddit.

    // FIXME: For some reason the action.onClicked event sometimes needs two
    //  clicks of the action button to trigger. Seems to be related to the
    //  sidebar already being open.
    const onActionButtonClicked = (tab: chrome.tabs.Tab): void => {
      syncTab(tab);
      reportAvailability();
    };

    assert(!startup.startupFinished);
    browser.action.onClicked.addListener(onActionButtonClicked);
    toStop.push(() =>
      browser.action.onClicked.removeListener(onActionButtonClicked),
    );

    // When permissions change, we may loose or gain access to tabs if the user
    // has granted or removed automatic host access to reddit tabs.
    const patterns = new Set(redditTabUrlPatterns());

    const onPermissionAddedOrRemoved = (
      permissions: chrome.permissions.Permissions,
    ) => {
      if (!permissions.origins?.some((origin) => patterns.has(origin))) return;
      // permissions.permissions is empty when adding/removing host permissions
      // Probably as there isn't an explicit permission name for host permissions.
      reloadTabs("permission change")
        .catch((e) =>
          log.error("failed to reload tabs after permission change", e),
        )
        .then(reportAvailability);
    };

    browser.permissions.onAdded.addListener(onPermissionAddedOrRemoved);
    toStop.push(() =>
      browser.permissions.onAdded.removeListener(onPermissionAddedOrRemoved),
    );
    browser.permissions.onRemoved.addListener(onPermissionAddedOrRemoved);
    toStop.push(() =>
      browser.permissions.onRemoved.removeListener(onPermissionAddedOrRemoved),
    );

    state.lastAvailability = (async () => {
      await reloadTabs("start");
      const availability = reportAvailability();

      if (state.isStopped) throw new Error("stopped");
      assert(availability);
      return availability;
    })();
    // ignore error on stop unless it's explicitly accessed
    state.lastAvailability.catch((e) => {
      if (e instanceof Error && e.message === "stopped") return;
      throw e;
    });

    state.stop = () => {
      if (state.isStopped) return;
      state.isStopped = true;
      for (const stop of toStop) stop();
    };

    return state as AvailabilityState;
  }

  get isStarted(): boolean {
    return this.#state !== undefined;
  }

  get availability(): Promise<Availability> {
    if (!this.#state) return Promise.reject(new Error("stopped"));
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
