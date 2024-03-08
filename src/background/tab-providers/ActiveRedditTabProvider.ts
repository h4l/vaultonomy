import { Emitter, createNanoEvents } from "nanoevents";

import { browser } from "../../webextension";
import { isRedditTab } from "../isReditTab";
import { TabNotAvailable, TabProvider, Unbind } from "./types";

/**
 * Provide access to the currently-active Reddit tab.
 *
 * This is a Reddit tab which was focussed when our action button was pressed,
 * if any. We have access to this tab thanks to the activeTab permission, even
 * if we don't have the host permission for reddit URLs.
 */
export class ActiveRedditTabProvider implements TabProvider {
  private emitter: Emitter<{ activeTabChanged: (id: number) => void }> =
    createNanoEvents();
  private activeTabId: number | undefined;

  constructor() {
    this.onActionClicked = this.onActionClicked.bind(this);
    browser.action.onClicked.addListener(this.onActionClicked);
  }

  private onActionClicked(tab: chrome.tabs.Tab): void {
    if (!isRedditTab(tab)) return;

    this.activeTabId = tab.id;
    this.emitter.emit("activeTabChanged", tab.id);
  }

  onActiveTabChanged(callback: (id: number) => void): Unbind {
    return this.emitter.on("activeTabChanged", callback);
  }

  async getTab(): Promise<chrome.tabs.Tab> {
    const tab =
      this.activeTabId === undefined ?
        null
      : await browser.tabs.get(this.activeTabId).catch(() => null);

    if (tab && isRedditTab(tab)) return tab;
    throw new TabNotAvailable("no active reddit tab");
  }

  unbind(): void {
    browser.action.onClicked.removeListener(this.onActionClicked);
    this.activeTabId = undefined;
  }
}
