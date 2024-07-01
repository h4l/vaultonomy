import { jest } from "@jest/globals";
import { mock } from "jest-mock-extended";

import { installWebextensionMock } from "../../__tests__/webextension.mock";

import { log } from "../../logging";
import { CouldNotConnect } from "../../rpc/connections";
import type { TabProvider } from "../tab-providers";

installWebextensionMock();

const { browser } = await import("../../webextension");
const { TabNotAvailable } = await import("../tab-providers");
const { redditTabConnector } = await import("../tab-connector");

describe("redditTabConnector", () => {
  beforeEach(() => {
    log.getLogger("background/tab-connector").disableAll();
  });
  test("throws CouldNotConnect if no tab is available", async () => {
    const tabProvider = mock<TabProvider>();
    tabProvider.getTab.mockRejectedValueOnce(new TabNotAvailable());

    const connector = redditTabConnector(tabProvider);

    const attempt = connector();
    await expect(attempt).rejects.toThrow(CouldNotConnect);
    await expect(attempt).rejects.toThrow("Tab not available");
  });

  test("throws CouldNotConnect if content script fails to execute in tab", async () => {
    const tab = await browser.tabs.create({ url: "https://www.reddit.com/" });
    const tabProvider = mock<TabProvider>();
    tabProvider.getTab.mockResolvedValueOnce(tab);

    const connector = redditTabConnector(tabProvider);

    const attempt = connector();
    await expect(attempt).rejects.toThrow(CouldNotConnect);
    await expect(attempt).rejects.toThrow(
      "Failed to execute content script in reddit tab",
    );
  });

  test("creates Port connection to tab", async () => {
    const tab = await browser.tabs.create({ url: "https://www.reddit.com/" });

    const tabProvider = mock<TabProvider>();
    tabProvider.getTab.mockResolvedValueOnce(tab);

    jest.mocked(browser.scripting.executeScript).mockImplementationOnce(
      async () =>
        [
          {
            frameId: 1,
            result: null,
          },
        ] satisfies chrome.scripting.InjectionResult<null>[],
    );

    const onDisconnect = jest.fn();

    const connector = redditTabConnector(tabProvider);
    const [port, disconnectPort] = await connector(onDisconnect);

    expect(browser.tabs.connect).toHaveBeenCalledTimes(1);
    expect(jest.mocked(browser.tabs.connect).mock.lastCall?.[0]).toBe(tab.id);
    expect(port.name).toContain("reddit-interaction");
    expect(port).toBe(jest.mocked(browser.tabs.connect).mock.results[0].value);

    expect(port.disconnect).not.toHaveBeenCalled();
    expect(onDisconnect).not.toHaveBeenCalled();

    disconnectPort();

    expect(port.disconnect).toHaveBeenCalled();
    expect(onDisconnect).toHaveBeenCalled();
  });
});
