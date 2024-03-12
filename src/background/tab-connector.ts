import { assert } from "../assert";
import { log as _log } from "../logging";
import { REDDIT_INTERACTION_PORT_NAME } from "../reddit/reddit-interaction-spec";
import { AsyncConnector, CouldNotConnect } from "../rpc/connections";
import { browser } from "../webextension";
import { createContentScriptPortConnector } from "../webextensions/port-connections";
import { isRedditTab } from "./isReditTab";
import { TabNotAvailable, TabProvider } from "./tab-providers";

const log = _log.getLogger("background/tab-connector");

export function redditTabConnector(
  tabProvider: TabProvider,
): AsyncConnector<chrome.runtime.Port> {
  return async (onDisconnect) => {
    let tab: chrome.tabs.Tab;
    try {
      tab = await tabProvider.getTab();
    } catch (cause) {
      if (!(cause instanceof TabNotAvailable)) throw cause;
      throw new CouldNotConnect("Tab not available", { cause });
    }

    assert(isRedditTab(tab));

    try {
      console.log("Running Vaultonomy's reddit client in active Reddit tab.");
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["reddit-contentscript.js"],
      });
    } catch (e) {
      const msg = "Failed to execute content script in reddit tab";
      log.error(`${msg}:`, e, tab);
      throw new CouldNotConnect(msg);
    }

    return createContentScriptPortConnector({
      tabId: tab.id,
      portName: REDDIT_INTERACTION_PORT_NAME,
    })(onDisconnect);
  };
}
