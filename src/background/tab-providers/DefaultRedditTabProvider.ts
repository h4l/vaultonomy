import { Unsubscribe } from "nanoevents";

import { ActiveRedditTabProvider } from "./ActiveRedditTabProvider";
import { GlobalRedditTabProvider } from "./GlobalRedditTabProvider";
import { PersistedRedditTabProvider } from "./PersistedRedditTabProvider";
import { TabNotAvailable, TabProvider } from "./types";

function isFulfilled<T>(
  arg: PromiseSettledResult<T>,
): arg is PromiseFulfilledResult<T> {
  return arg.status === "fulfilled";
}

export class DefaultRedditTabProvider implements TabProvider {
  private readonly activeTabProvider: ActiveRedditTabProvider;
  private readonly persistedTabProvider: PersistedRedditTabProvider;
  private readonly globalTabProvider: GlobalRedditTabProvider;
  private readonly unbindActiveTabChanged: Unsubscribe;

  constructor() {
    this.activeTabProvider = new ActiveRedditTabProvider();
    this.persistedTabProvider = new PersistedRedditTabProvider();
    this.globalTabProvider = new GlobalRedditTabProvider();

    this.unbindActiveTabChanged = this.activeTabProvider.onActiveTabChanged(
      (id) => {
        this.persistedTabProvider.setTab(id);
      },
    );
  }
  async getTab(): Promise<chrome.tabs.Tab> {
    const results = await Promise.allSettled([
      this.persistedTabProvider.getTab(),
      this.activeTabProvider.getTab(),
      this.globalTabProvider.getTab(),
    ]);
    const tab = results.find(isFulfilled)?.value;

    if (tab) return tab;
    throw new TabNotAvailable("no reddit tab is available");
  }

  unbind(): void {
    this.unbindActiveTabChanged();
    this.activeTabProvider.unbind();
    this.persistedTabProvider.unbind();
    this.globalTabProvider.unbind();
  }
}
