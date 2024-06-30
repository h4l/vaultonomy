import { jest } from "@jest/globals";

import { installWebextensionMock } from "../../__tests__/webextension.mock";

installWebextensionMock();

const { RedditTabObserver } = await import("../RedditTabObserver");
const { browser } = await import("../../webextension");

describe("RedditTabObserver", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("start / stop", async () => {
    const observer = new RedditTabObserver();
    expect(observer.isStarted).toBeFalsy();
    await expect(observer.availability).rejects.toThrow("stopped");

    const onStop = jest.fn();
    observer.emitter.on("stopped", onStop);

    observer.start();
    expect(observer.isStarted).toBeTruthy();

    observer.stop();
    expect(observer.isStarted).toBeFalsy();
    expect(onStop).toHaveBeenCalled();
  });

  test("reports availability after reddit tab becomes available", async () => {
    await browser.permissions.request({
      permissions: ["tabs"],
      origins: ["https://www.reddit.com/*"],
    });

    const observer = new RedditTabObserver();
    observer.start();

    const onAvailabilityChanged = jest.fn();
    observer.emitter.on("availabilityChanged", onAvailabilityChanged);

    await expect(observer.availability).resolves.toBe("unavailable");
    expect(onAvailabilityChanged).toHaveBeenLastCalledWith("unavailable");

    // reports available when a reddit tab appears
    const t1 = await browser.tabs.create({ active: true });
    await browser.tabs.update(t1.id!, { url: "https://www.reddit.com/" });
    await jest.runOnlyPendingTimersAsync();

    expect(onAvailabilityChanged).toHaveBeenLastCalledWith("available");
    await expect(observer.availability).resolves.toBe("available");

    // reports unavailable when a reddit tab exists but we don't have permission
    await browser.permissions.remove({
      permissions: ["tabs"],
      origins: ["https://www.reddit.com/*"],
    });
    await jest.runOnlyPendingTimersAsync();

    expect(onAvailabilityChanged).toHaveBeenLastCalledWith("unavailable");
    await expect(observer.availability).resolves.toBe("unavailable");

    // reports available when a reddit tab exists but we gain permission
    await browser.permissions.request({
      permissions: ["tabs"],
      origins: ["https://www.reddit.com/*"],
    });
    await jest.runOnlyPendingTimersAsync();

    expect(onAvailabilityChanged).toHaveBeenLastCalledWith("available");
    await expect(observer.availability).resolves.toBe("available");

    // reports unavailable when a reddit tab is navigated away
    await browser.tabs.update(t1.id!, { url: "https://example.com/" });
    await jest.runOnlyPendingTimersAsync();

    expect(onAvailabilityChanged).toHaveBeenLastCalledWith("unavailable");
    await expect(observer.availability).resolves.toBe("unavailable");

    // reports unavailable when a reddit tab is closed...
    await browser.tabs.update(t1.id!, { url: "https://www.reddit.com/" });
    await jest.runOnlyPendingTimersAsync();

    expect(onAvailabilityChanged).toHaveBeenLastCalledWith("available");
    await expect(observer.availability).resolves.toBe("available");

    // ...close the tab
    await browser.tabs.remove(t1.id!);
    await jest.runOnlyPendingTimersAsync();

    expect(onAvailabilityChanged).toHaveBeenLastCalledWith("unavailable");
    await expect(observer.availability).resolves.toBe("unavailable");
  });
});
