import browser from "webextension-polyfill";

// const entry = await import.meta.resolve('page-entry.ts')

// let window: Promise<browser.Windows.Window> | undefined;

export async function main() {
  console.log("background main");

  browser.action.onClicked.addListener(async (tab) => {
    console.log("action clicked");
    if (!tab.id) return;
    browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["/reddit.js"],
    });
    browser.tabs.create({
      url: "/popup.html",
      windowId: tab.windowId,
    });

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
