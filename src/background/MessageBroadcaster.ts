import { log } from "../logging";
import { browser } from "../webextension";

export class MessageBroadcaster {
  private tabsRunningContentScript: Set<number>;

  constructor(tabsRunningContentScript?: Iterable<number>) {
    this.tabsRunningContentScript = new Set(tabsRunningContentScript);
  }

  registerTabRunningContentScript(tabId: number): void {
    this.tabsRunningContentScript.add(tabId);
  }

  sendMessageAndIgnoreResponses<T = unknown>(message: T): void {
    browser.runtime.sendMessage(message).catch((error) => {
      log.error(`Failed to sendMessage to current extension:`, error);
    });

    for (const tabId of this.tabsRunningContentScript) {
      browser.tabs.sendMessage(tabId, message).catch((error) => {
        // TODO: remove tab?
        log.error(`Failed to sendMessage to tab ${tabId}:`, error);
      });
    }
  }
}
