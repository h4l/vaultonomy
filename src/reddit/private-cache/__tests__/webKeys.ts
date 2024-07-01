import { IDBFactory } from "fake-indexeddb";

import {
  OpenDatabaseError,
  ReadDatabaseError,
  WriteDatabaseError,
  deleteVaultonomyIndexedDB,
  getWrappingKey,
  setWrappingKey,
} from "../webKeys";

beforeEach(() => {
  global.indexedDB = new IDBFactory();
});

test("key is undefined before key is set", async () => {
  const wrappingKey = await getWrappingKey();
  expect(wrappingKey).toBeUndefined();
});

test("key is the same as the last-set key", async () => {
  // Do this twice so that we overwrite a previous key
  for (const _ of [0, 1]) {
    const key: CryptoKey = await genKey({ extractable: true }); // need to extract to check equality

    await setWrappingKey(key);
    const wrappingKey1 = await getWrappingKey();

    expect(wrappingKey1).not.toBeUndefined();
    expect(await extractKeyBytes(key)).toStrictEqual(
      await extractKeyBytes(wrappingKey1!),
    );
  }
});

test("setting non-extractable keys works too", async () => {
  await setWrappingKey(await genKey({ extractable: false }));
  await expect(getWrappingKey()).resolves.not.toBeUndefined();
});

test("deleteVaultonomyIndexedDB() clears data", async () => {
  await setWrappingKey(await genKey({ extractable: false }));
  await expect(getWrappingKey()).resolves.not.toBeUndefined();

  await deleteVaultonomyIndexedDB();
  await expect(getWrappingKey()).resolves.toBeUndefined();
});

function createBrokenVaultonomyDb({
  version,
}: {
  version: number;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const openReq = indexedDB.open("vaultonomy", version);
    // create a higher version than expected
    openReq.onerror = reject;
    // openReq.onupgradeneeded = () => {}
    openReq.onsuccess = () => {
      openReq.result.close();
      resolve();
    };
  });
}

test("reports error when opening broken database", async () => {
  await createBrokenVaultonomyDb({ version: 2 }); // version is too high

  const result = getWrappingKey();
  await expect(result).rejects.toThrow(OpenDatabaseError);
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
    `"Failed to open database vaultonomy: VersionError: An attempt was made to open a database using a lower version than the existing version."`,
  );
});

test("reports error when database schema is wrong when reading", async () => {
  // version OK but db has no object store created
  await createBrokenVaultonomyDb({ version: 1 });

  const result = getWrappingKey();
  await expect(result).rejects.toThrow(ReadDatabaseError);
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
    `"Failed to get wrapping key: NotFoundError: No objectStore named keys in this database"`,
  );
});

test("reports error when database schema is wrong when writing", async () => {
  // version OK but db has no object store created
  await createBrokenVaultonomyDb({ version: 1 });

  const result = setWrappingKey(await await genKey({ extractable: true }));
  await expect(result).rejects.toThrow(WriteDatabaseError);
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
    `"Failed to set wrapping key: NotFoundError: No objectStore named keys in this database"`,
  );
});

test("deleteVaultonomyIndexedDB() fixes broken db", async () => {
  await createBrokenVaultonomyDb({ version: 1 });
  const result = setWrappingKey(await genKey({ extractable: false }));
  await expect(result).rejects.toThrow(WriteDatabaseError);

  await deleteVaultonomyIndexedDB();
  const key = await genKey({ extractable: true });
  await setWrappingKey(key);
  const wrappingKey = await getWrappingKey();
  expect(wrappingKey && (await extractKeyBytes(wrappingKey))).toStrictEqual(
    await extractKeyBytes(key),
  );
});

async function genKey(options: { extractable: boolean }): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: "AES-KW", length: 256 },
    options.extractable,
    ["wrapKey", "unwrapKey"],
  );
}

async function extractKeyBytes(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}
