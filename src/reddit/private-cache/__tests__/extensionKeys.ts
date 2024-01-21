import { jest } from "@jest/globals";

import { MockStorage } from "../../../__tests__/webextension.mock";

jest.unstable_mockModule("./src/webextension", () => {
  return {
    browser: {
      storage: { local: new MockStorage() },
    },
  };
});

const extensionKeys = await import("../extensionKeys");

test("key is undefined before key is set", async () => {
  const wdk = await extensionKeys.getWrappedDataKey();
  expect(wdk).toBeUndefined();
});

test("key is the same as the last-set key", async () => {
  for (const key of ["0xc0ffee", "0x1eaf1ea"] as const) {
    await extensionKeys.setWrappedDataKey(key);
    const readKey = await extensionKeys.getWrappedDataKey();
    expect(key).toStrictEqual(readKey);
  }
});
