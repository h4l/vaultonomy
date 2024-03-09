import { installWebextensionMock } from "../../../__tests__/webextension.mock";

import { assert } from "../../../assert";

installWebextensionMock();

const { browser } = await import("../../../webextension");
const { GlobalRedditTabProvider } = await import("../GlobalRedditTabProvider");

describe("GlobalRedditTabProvider", () => {
  let bgWindow: chrome.windows.Window;
  let fgWindow: chrome.windows.Window;
  beforeEach(async () => {
    bgWindow = await browser.windows.create({ focused: false });
    fgWindow = await browser.windows.create({ focused: true });
  });

  test("returns highest-priority available tab", async () => {
    const dp = new GlobalRedditTabProvider();
    const createTab = async (
      options: chrome.tabs.CreateProperties & Partial<chrome.tabs.Tab> = {},
    ) => {
      options = {
        url: "https://www.reddit.com/example",
        status: "complete",
        active: false,
        windowId: bgWindow.id,
        pinned: false,
        discarded: false,
        ...options,
      };
      return await browser.tabs.create({
        ...options,
      });
    };
    const discardedBgTab = await createTab({ discarded: true });
    const loadingBgTab = await createTab({ status: "loading" });
    const loadingFgTab = await createTab({
      status: "loading",
      windowId: fgWindow.id,
    });
    const activeBgTab = await createTab({ active: true });
    const activeFgTab = await createTab({
      active: true,
      windowId: fgWindow.id,
    });
    const pinnedActiveFgTab = await createTab({
      active: true,
      pinned: true,
      windowId: fgWindow.id,
    });
    const pinnedActiveBgTab = await createTab({
      active: true,
      pinned: true,
    });
    const pinnedInactiveFgTab = await createTab({
      active: false,
      pinned: true,
      windowId: fgWindow.id,
    });
    const discardedPinnedFgTab = await createTab({
      active: true,
      pinned: true,
      windowId: fgWindow.id,
      discarded: true,
    });

    const order = [
      pinnedActiveFgTab,
      pinnedInactiveFgTab,
      pinnedActiveBgTab,
      activeFgTab,
      activeBgTab,
      loadingFgTab,
      loadingBgTab,
      discardedPinnedFgTab,
      discardedBgTab,
    ];

    await browser.permissions.request({
      permissions: ["tabs"],
      origins: ["https://www.reddit.com/*"],
    });

    for (const tab of order) {
      const providedTab = await dp.getTab();
      assert(tab.id !== undefined && providedTab.id !== undefined);

      expect(providedTab.id).toEqual(tab.id);

      await browser.tabs.remove(tab.id!);
    }

    expect((await browser.tabs.query({})).length).toBe(0);
    dp.unbind();
  });
});
