import { log as _log } from "../../logging";
import { browser } from "../../webextension";
import { isRedditTab } from "../isReditTab";
import { TabNotAvailable, TabProvider } from "./types";

const log = _log.getLogger("background/tab-providers");

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
