import { HexString } from "../../types";
import { browser } from "../../webextension";

const WRAPPED_DATA_KEY_KEY = "private-cache#WrappedDataKey";

export async function getWrappedDataKey(): Promise<HexString | undefined> {
  const hexKey = (await browser.storage.local.get(WRAPPED_DATA_KEY_KEY))[
    WRAPPED_DATA_KEY_KEY
  ];
  if (typeof hexKey === "string" && hexKey.startsWith("0x")) {
    return hexKey as HexString;
  }
  if (hexKey === null || hexKey === undefined) {
    return undefined;
  }
  throw new Error(
    `Unexpected value store for ${WRAPPED_DATA_KEY_KEY}: ${JSON.stringify(
      hexKey,
    )}`,
  );
}

export async function setWrappedDataKey(
  wrappedDataKey: HexString,
): Promise<void> {
  await browser.storage.local.set({ [WRAPPED_DATA_KEY_KEY]: wrappedDataKey });
}
