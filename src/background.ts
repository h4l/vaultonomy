import { assert } from "./assert";
import { browser } from "./webextension";

/*
Tab connection strategy
-----------------------

There are 4 main ways we could approach establishing communication with Reddit:

1. Include an iframe hosting a Reddit page in our UI
  - Reddit (quite sensibly) uses X-Frame-Options to prevent being loaded in
    iframes.
  - iframe would go away if our UI was closed — couldn't maintain background
    connections.
2. Request global host permissions for reddit.com
  - Simplest to implement, but the extension always has access to all reddit
    pages, which is not necessary
3. Use an optional host permission for reddit.com and request it when active.
   possibly auto-revoke it when not active, or after some delay.
  - More complex than 2, and potentially annoying for users to be prompted to
    grant access.
  - Grants access to all reddit tabs, not just a single tab
4. Use activeTab permission require that the user trigger the extension on a
   reddit tab.
  - Good for privacy, as the extension has no access until triggered, and
    closing the tab cuts off the access.
  - No need for permission requests, either at install or runtime
  - Potential for bad UX when opening the extension when a reddit tab is not
    active. Or when the extension is active, but the tab the user started on is
    closed.

The Headgear extension uses 4 in conjunction with a popup window. That works
well, as the popup can't stay open if the tab is changed. Here we're using
either separate full tabs/windows or the sidebar, which allows the lifetime of
the extension UI to outlive the reddit tab. Still, my feeling is that 4 is still
a good option. Using a sidebar by default should tie the extension to a tab from
a user POV.
*/

// const entry = await import.meta.resolve('page-entry.ts')

// let window: Promise<browser.Windows.Window> | undefined;
const activeTabs = new Set<chrome.tabs.Tab>();
const popupTabs: chrome.tabs.Tab[] = [];

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

async function loadReddit() {
  (await import(chrome.runtime.getURL("reddit.js"))).main();
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
      func: loadReddit,
    });
  } catch (e) {
    console.log(
      "Failed to connect to tab that was previously a reddit tab. ",
      "It may have navigated to another domain.",
      e
    );
  }
}

function discoverRedditTab() {
  chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
    console.log("onUpdated", { url: tab.url, tabId, info, tab });
  });
}

// let popupWindow: Promise<chrome.tabs.Tab> | undefined;

// TODO: store a list of opened tabs to restore, as browser.tabs.query does not
// seem to return extension page tabs.

export async function main() {
  console.log("background main");
  discoverRedditTab();
  handleAvailabilityConnections();

  browser.action.onClicked.addListener(async (tab) => {
    console.log("action clicked");
    if (!tab.id) return;

    console.log("Opening side panel");
    chrome.sidePanel.setOptions({
      enabled: true,
      path: "popup.html",
      tabId: tab.id,
    });
    chrome.sidePanel.open({ windowId: tab.windowId });

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

    // Seems to always be empty
    // const existingTabs = await browser.tabs.query({
    //   url: browser.runtime.getURL("/*"),
    //   currentWindow: true,
    // });
    //.filter((t) => typeof t.id === "number");
    const existingTabs = popupTabs;
    console.log("existingTabs:", existingTabs, browser.runtime.getURL("/*"));

    if (existingTabs.length === 0) {
      existingTabs.push(await browser.tabs.create({ url: "/popup.html" }));
    } else {
      // Find the closest tab
      const activeTab = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      // const activeTabIndex = activeTab.at(0)?.index ?? 0;
      // existingTabs.sort((a, b) => {
      //   const distanceA = Math.abs(a.index - activeTabIndex);
      //   const distanceB = Math.abs(b.index - activeTabIndex);
      //   return distanceA - distanceB;
      // });
      const id = existingTabs[0].id;
      assert(typeof id === "number");
      console.log("Activating first tab from:", existingTabs[0]);
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
