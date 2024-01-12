import { z } from "zod";

import { assertUnreachable } from "./assert";
import {
  Message,
  RedditTabBecameAvailableEvent,
  RedditTabBecameUnavailableEvent,
  UINeedsRedditTabEvent,
  UINeedsRedditTabResponse,
  availabilityPortName,
} from "./messaging";
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

interface ConnectedRedditTab {
  tab: chrome.tabs.Tab;
  port: chrome.runtime.Port;
}

let redditTab: ConnectedRedditTab | undefined;

const ActiveRedditTab = z.object({ tabId: z.number() });
type ActiveRedditTab = z.infer<typeof ActiveRedditTab>;

const activeRedditTabStorageKey = "activeRedditTab";

async function loadActiveRedditTab(): Promise<ActiveRedditTab | null> {
  const raw = (await browser.storage.session.get(activeRedditTabStorageKey))[
    activeRedditTabStorageKey
  ];
  const result = ActiveRedditTab.safeParse(raw);
  if (!result.success) {
    if (raw) {
      console.warn(
        `Invalid value persisted for ${activeRedditTabStorageKey}: ${result.error}`,
      );
    }
    return null;
  }
  return result.data;
}

async function saveActiveRedditTab(
  activeRedditTab: ActiveRedditTab | null,
): Promise<void> {
  await browser.storage.session.set({
    [activeRedditTabStorageKey]: activeRedditTab,
  });
}

function isRedditTab(tab: chrome.tabs.Tab): boolean {
  // TODO: maybe allow aliases like new.reddit.com?
  return tab.url?.startsWith("https://www.reddit.com/") || false;
}

export function handleAvailabilityConnections() {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== availabilityPortName) return;

    const tab = port.sender?.tab;
    if (!tab || !tab.id) {
      throw new Error(`Port connected for availability without a sender.tab`);
    }
    if (!isRedditTab(tab)) return;
    if (redditTab && isRedditTab(redditTab.tab)) {
      console.warn(
        `Port connected for availability with a tab already available, closing new connection`,
      );
      port.disconnect();
      return;
    }
    console.log("received availability connection from tab:", tab);
    redditTab = { tab, port };
    saveActiveRedditTab({ tabId: tab.id }).catch(console.error);
    sendMessageAndIgnoreResponses<RedditTabBecameAvailableEvent>({
      type: "redditTabBecameAvailable",
      tabId: tab.id,
    });

    port.onDisconnect.addListener((port) => {
      console.log("availability port disconnected:", port);
      if (redditTab?.port === port) {
        saveActiveRedditTab(null).catch(console.error);
        const tabId = tab.id;
        redditTab = undefined;

        browser.action.setBadgeText({ text: "" });

        if (!tabId) {
          console.warn(
            "Tab associated with disconnected availability port has no tabId — not broadcasting disconnection",
          );
          return;
        }
        sendMessageAndIgnoreResponses<RedditTabBecameUnavailableEvent>({
          type: "redditTabBecameUnavailable",
          tabId: tabId,
        });
      }
    });
  });
}

function sendMessageAndIgnoreResponses<M extends { type: string }>(
  message: M,
): void {
  browser.runtime.sendMessage<M, void>(message).catch((error) => {
    // sendMessage will reject if nobody is listening for the message.
    if (
      import.meta.env.MODE === "development" &&
      !/Could not establish connection/.test(`${error}`)
    ) {
      console.error(`Receiver of '${message.type}' message failed:`, {
        message,
        error,
      });
    }
  });
}

export async function connectToActiveRedditTab(
  tab: chrome.tabs.Tab,
): Promise<void> {
  if (redditTab !== undefined) {
    console.log("Already connected to a Reddit tab — ignoring.");
    return;
  }
  if (!isRedditTab(tab)) {
    console.log("Active tab is not a Reddit tab — ignoring.");
    return;
  }
  if (!tab.id) {
    console.warn("Active tab has no id — ignoring.");
    return;
  }
  try {
    console.log("Running Vaultonomy's reddit client in active Reddit tab.");
    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      // TODO: can we re-introduce the function loading method?
      // func: loadReddit,
      files: ["reddit-contentscript.js"],
    });
  } catch (e) {
    console.log(
      "Failed to connect to tab that was previously a reddit tab. ",
      "It may have navigated to another domain.",
      e,
    );
  }
}

export function handleActionButtonClick(tab: chrome.tabs.Tab) {
  console.log("handleActionButtonClick()", new Date().toLocaleTimeString());
  ensureSidePanelIsOpenAndDisplayingVaultonomy(tab);
  reConnectToActiveTabOrCurrentTab(tab).catch(console.error);
}

async function reConnectToActiveTabOrCurrentTab(
  currentTab: chrome.tabs.Tab,
): Promise<void> {
  // Clicking the action button can wake up this service worker after it was
  // shut down. If we were connected to a Reddit tab before, we re-use that tab
  // rather than connecting to the current tab.
  const activeTabInfo = await loadActiveRedditTab();
  if (activeTabInfo) {
    const activeTab = await browser.tabs.get(activeTabInfo.tabId);
    if (isRedditTab(activeTab)) {
      console.log("handleActionButtonClick: restored saved active tab");
      currentTab = activeTab;
    }
  }

  if (!currentTab.id) {
    console.warn("handleActionButtonClick: ignored click with no tab.id");
    return;
  }

  // TODO: review & tidy this
  connectToActiveRedditTab(currentTab);
}

function ensureSidePanelIsOpenAndDisplayingVaultonomy(tab: chrome.tabs.Tab) {
  console.log("Opening side panel");
  // Enable our page in the side panel for the whole current window, not just
  // the current tab. So our page remains open when changing tabs. Users can
  // close the side panel, or open a different side-panel page and re-open our
  // page later by triggering this again by clicking our Action button.
  //
  // We could open just on the current tab, but it seems useful to be able to
  // view our sidepanel while viewing a different website, e.g. to follow
  // instructions. And opening on a single tab would result in multiple
  // instances being open on different tabs, each with their own state. That
  // would surely be confusing.
  chrome.sidePanel.setOptions({
    enabled: true,
    path: "ui.html",
  });
  chrome.sidePanel.open({ windowId: tab.windowId });
}

function handleMessage(
  _message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
): true | undefined {
  const result = Message.safeParse(_message);
  if (!result.success) {
    console.warn(
      `handleMessage: unknown message:`,
      _message,
      result.error.format(),
    );
    return;
  }
  const message = result.data;
  switch (message.type) {
    case "redditTabBecameAvailable":
      return;
    case "redditTabBecameUnavailable":
      return;
    case "uiNeedsRedditTab":
      handleUiNeedsRedditTab(message)
        .then((response) => sendResponse(response))
        .catch((error) => console.error(error));
      return true;
  }
  assertUnreachable(message);
}

async function handleUiNeedsRedditTab(
  _event: UINeedsRedditTabEvent,
): Promise<UINeedsRedditTabResponse> {
  if (redditTab?.tab.id !== undefined) {
    return { success: true, tabId: redditTab.tab.id };
  }
  return { success: true, tabId: null };
}

export function main() {
  console.log("background main", new Date().toLocaleTimeString());
  handleAvailabilityConnections();
  browser.action.onClicked.addListener(handleActionButtonClick);
  browser.runtime.onMessage.addListener(handleMessage);
  return;
}
