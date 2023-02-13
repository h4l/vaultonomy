import { assert } from "./assert";
import { browser } from "./webextension";

// const entry = await import.meta.resolve('page-entry.ts')

// let window: Promise<browser.Windows.Window> | undefined;
const activeTabs = new Set<chrome.tabs.Tab>();

export function handleAvailabilityConnections() {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== "availability") return;

    const tab = port.sender?.tab;
    if (!tab) {
      throw new Error(`Port connected for "availability" without a sender.tab`);
    }
    console.log("received availability connection from tab:", tab);
    activeTabs.add(tab);
    console.log("active tabs:", activeTabs);

    investigateActiveTabQueryResults();

    port.onDisconnect.addListener((port) => {
      console.log("availability port disconnected:", port);
      activeTabs.delete(port.sender?.tab as chrome.tabs.Tab);
      console.log("active tabs:", activeTabs);

      // Try to re-connect to tab
      console.log("trying to re-connect to disconnected reddit tab");
      connectToActiveRedditTab(tab);
    });
  });
}

async function investigateActiveTabQueryResults() {
  const tabs = await chrome.tabs.query({});
  const redditTabs = tabs.filter((t) =>
    t.url?.startsWith("https://www.reddit.com/")
  );
  console.log(
    "all reddit tabs results:",
    redditTabs,
    "seen active reddit tabs:",
    [...activeTabs]
  );
}

export async function connectToActiveRedditTab(
  tab: chrome.tabs.Tab
): Promise<void> {
  if (!tab.url?.startsWith("https://www.reddit.com/")) {
    console.log("active tab is not a Reddit tab, ignoring");
    return;
  }
  if (!tab.id) {
    console.warn("active tab has no id, ignoring");
    return;
  }
  try {
    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["/reddit.js"],
    });
  } catch (e) {
    console.log(
      "Failed to connect to tab that was previously a reddit tab. ",
      "It may have navigated to another domain.",
      e
    );
  }
}

let popupWindow: Promise<chrome.tabs.Tab> | undefined;

// TODO: store a list of opened tabs to restore, as browser.tabs.query does not
// seem to return extension page tabs.

export async function main() {
  console.log("background main");
  handleAvailabilityConnections();

  browser.action.onClicked.addListener(async (tab) => {
    console.log("action clicked");
    if (!tab.id) return;
    console.log("connecting #1");
    connectToActiveRedditTab(tab);
    console.log("connecting #2");
    connectToActiveRedditTab(tab);

    // TODO: window management:
    // Chrome/brave do not actually focus or draw attention to a background
    // window when chrome.windows.update() is called. So if we open our UI as a
    // popup window, the only option to show it to the user would be to open a
    // new window. We could close any existing window when doing this, but it
    // feels a bit clumsy.
    //
    // What we can do is to focus a tab in the currently-active window. So if
    // the user already has a tab with our UI open in their window, we can focus
    // that. If not, we can create a tab with our UI.
    //
    // Users won't end up with multiple instances of the UI open unless they go
    // to distinct windows and trigger the extension in each window. This should
    // result in intuitive behaviour, as triggering the extension action will
    // always result in a visible action — either an existing tab is focussed,
    // or a tab is opened.

    const allWindowtabs = await browser.tabs.query({
      currentWindow: true,
    });
    console.log("allWindowtabs", allWindowtabs);

    const existingTabs = await browser.tabs.query({
      url: browser.runtime.getURL("/*"),
      currentWindow: true,
    });
    //.filter((t) => typeof t.id === "number");
    console.log("existingTabs:", existingTabs, browser.runtime.getURL("/*"));

    if (existingTabs.length === 0) {
      browser.tabs.create({ url: "/popup.html" });
    } else {
      // Find the closest tab
      const activeTab = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      const activeTabIndex = activeTab.at(0)?.index ?? 0;
      existingTabs.sort((a, b) => {
        const distanceA = Math.abs(a.index - activeTabIndex);
        const distanceB = Math.abs(b.index - activeTabIndex);
        return distanceA - distanceB;
      });
      const id = existingTabs[0].id;
      assert(typeof id === "number");
      chrome.tabs.update(id, { active: true });
    }

    // if (popupWindow === undefined) {
    //   popupWindow = (async () => {
    //     const win = await browser.windows.create({
    //       type: "popup",
    //       url: "/popup.html",
    //     });
    //     const tab = win.tabs?.at(0);
    //     assert(tab);
    //     return tab;
    //   })();

    //   // popupWindow = browser.tabs.create({
    //   //   url: "/popup.html",
    //   //   windowId: tab.windowId,
    //   // });
    // } else {
    //   const popup = await popupWindow;
    //   assert(typeof popup.id === "number");
    //   console.log("activatign previously-opened popup...", popup);
    //   chrome.tabs.update(popup.id, { active: true });
    //   // console.log("drawing attention to window of previously-opened popup...");
    //   // chrome.windows.update(tab.windowId, { drawAttention: true });
    //   console.log("focussing window of previously-opened popup...");
    //   chrome.windows.update(tab.windowId, { focused: true });
    // }

    // let openWindow = await window;
    // console.log("openWindow:", openWindow);
    // if (!(openWindow && typeof openWindow.id === "number")) {
    //   window = browser.windows.create({
    //     type: "popup",
    //     url: "/popup.html",

    //   });
    // }
  });

  browser.runtime.onMessage.addListener(async (msg) => {
    console.log("background: onMessage:", msg);
  });
}
