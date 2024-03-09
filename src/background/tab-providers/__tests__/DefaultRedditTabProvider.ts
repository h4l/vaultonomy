import { jest } from "@jest/globals";

import {
  activeTabAccessible,
  installWebextensionMock,
  markActiveTabAccessible,
  mockedEvent,
} from "../../../__tests__/webextension.mock";

import { assert } from "../../../assert";
import { TabNotAvailable } from "../types";

installWebextensionMock();

const { browser } = await import("../../../webextension");
const { ActiveRedditTabProvider } = await import("../ActiveRedditTabProvider");
const { GlobalRedditTabProvider } = await import("../GlobalRedditTabProvider");
const { PersistedRedditTabProvider } = await import(
  "../PersistedRedditTabProvider"
);
const { DefaultRedditTabProvider } = await import(
  "../DefaultRedditTabProvider"
);

describe("DefaultRedditTabProvider", () => {
  beforeEach(async () => {
    await browser.windows.create({ focused: true }); // we need a current window
  });

  test("throws TabNotAvailable when no tabs are available", async () => {
    const dp = new DefaultRedditTabProvider();

    await expect(dp.getTab()).rejects.toThrow(TabNotAvailable);

    dp.unbind();
  });

  test("unbinds from event listeners", async () => {
    const unbindActive = jest.spyOn(
      ActiveRedditTabProvider.prototype,
      "unbind",
    );
    const unbindGlobal = jest.spyOn(
      GlobalRedditTabProvider.prototype,
      "unbind",
    );
    const unbindPersisted = jest.spyOn(
      PersistedRedditTabProvider.prototype,
      "unbind",
    );

    const dp = new DefaultRedditTabProvider();
    await dp.getTab().catch(() => {});
    dp.unbind();

    expect(unbindActive).toHaveBeenCalled();
    expect(unbindGlobal).toHaveBeenCalled();
    expect(unbindPersisted).toHaveBeenCalled();
  });

  test("unbinds from active tab", async () => {
    const dp = new DefaultRedditTabProvider();
    await dp.getTab().catch(() => {});
    dp.unbind();

    expect(browser.action.onClicked.addListener).toHaveBeenCalled();
    expect(browser.action.onClicked.removeListener).toHaveBeenCalled();
  });

  test("unbinds from active tab", async () => {
    const dp = new DefaultRedditTabProvider();
    await dp.getTab().catch(() => {});
    dp.unbind();

    expect(browser.action.onClicked.addListener).toHaveBeenCalled();
    expect(browser.action.onClicked.removeListener).toHaveBeenCalled();
  });

  test("provides active tab", async () => {
    const dp = new DefaultRedditTabProvider();

    await browser.permissions.request({ permissions: ["activeTab"] });
    const activeTab = await browser.tabs.create(
      markActiveTabAccessible({
        url: "https://www.reddit.com/active",
      }),
    );
    mockedEvent(browser.action.onClicked).emit(activeTab);

    const tab = await dp.getTab();
    assert(tab.id !== undefined);
    expect(tab.id).toBe(activeTab.id);

    dp.unbind();
  });

  test("provides background tab", async () => {
    const dp = new DefaultRedditTabProvider();

    await browser.permissions.request({
      permissions: ["tabs"],
      origins: ["https://www.reddit.com/*"],
    });

    assert((await browser.tabs.query({})).length === 0);
    const nonActiveTab = await browser.tabs.create({
      url: "https://www.reddit.com/background",
    });

    const tab = await dp.getTab();
    expect(tab.id).toEqual(nonActiveTab.id);
    expect(tab.url).toEqual(nonActiveTab.url);

    dp.unbind();
  });

  test("provides highest-priority tab", async () => {
    let dp = new DefaultRedditTabProvider();
    await browser.permissions.request({ permissions: ["activeTab"] });

    const activeTab1 = await browser.tabs.create(
      markActiveTabAccessible({
        url: "https://www.reddit.com/1",
      }),
    );
    mockedEvent(browser.action.onClicked).emit(activeTab1);

    expect((await dp.getTab()).id === activeTab1.id).toBeTruthy();

    // When a new tab activates, it replaces the previous one
    const activeTab2 = await browser.tabs.create(
      markActiveTabAccessible({
        url: "https://www.reddit.com/2",
      }),
    );
    mockedEvent(browser.action.onClicked).emit(activeTab2);
    expect((await dp.getTab()).id === activeTab2.id).toBeTruthy();

    // A new provider (e.g. after being suspended) has no knowledge of the
    // action button click, but restores from persisted state
    dp = new DefaultRedditTabProvider();
    expect((await dp.getTab()).id === activeTab2.id).toBeTruthy();

    // If second (persisted) active tab is closed, we can still access the first
    await browser.tabs.remove(activeTab2.id!);
    expect((await dp.getTab()).id === activeTab1.id).toBeTruthy();

    // If there are no active tabs and we don't have host permissions, we can't
    // access reddit.
    await browser.tabs.remove(activeTab1.id!);
    const nonActiveTab = await browser.tabs.create({
      url: "https://www.reddit.com/3",
    });

    await expect(dp.getTab()).rejects.toThrow(TabNotAvailable);

    // If we're given host permissions, we can though
    await browser.permissions.request({
      permissions: ["tabs"],
      origins: ["https://www.reddit.com/*"],
    });
    expect((await dp.getTab()).id === nonActiveTab.id).toBeTruthy();

    dp.unbind();
  });
});
