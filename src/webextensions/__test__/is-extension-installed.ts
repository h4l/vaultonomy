import { jest } from "@jest/globals";

jest.unstable_mockModule("./src/webextension", () => {
  return {
    browser: {
      runtime: {
        sendMessage: jest.fn(),
      },
    },
  };
});

const { browser } = await import("../../webextension");
const { isExtensionInstalled } = await import("../is-extension-installed");

describe("isExtensionInstalled", () => {
  test("reports installed when messaging succeeds", async () => {
    jest.mocked(browser.runtime.sendMessage).mockResolvedValueOnce(null);
    await expect(isExtensionInstalled("installed")).resolves.toBeTruthy();
    expect(browser.runtime.sendMessage).toHaveBeenLastCalledWith(
      "installed",
      null
    );
  });

  test("reports not installed when messaging fails", async () => {
    jest.mocked(browser.runtime.sendMessage).mockRejectedValueOnce("boom");
    await expect(isExtensionInstalled("notinstalled")).resolves.toBeFalsy();
    expect(browser.runtime.sendMessage).toHaveBeenLastCalledWith(
      "notinstalled",
      null
    );
  });
});
