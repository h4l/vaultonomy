import { browser } from "../../webextension";
import { redditTabUrlPatterns } from "../isReditTab";
import { TabNotAvailable, TabProvider } from "./types";

export class GlobalRedditTabProvider implements TabProvider {
  async getTab(): Promise<chrome.tabs.Tab> {
    const [window, tabs] = await Promise.all([
      browser.windows.getCurrent(),
      browser.tabs.query({ url: redditTabUrlPatterns() }),
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
        statusScore(a) - statusScore(b) ||
        pinnedScore(a) - pinnedScore(b) ||
        currentWindowScore(a) - currentWindowScore(b) ||
        activeScore(a) - activeScore(b),
    );

    if (tabs[0]) return tabs[0];
    throw new TabNotAvailable("no reddit tabs are open");
  }

  unbind(): void {}
}
