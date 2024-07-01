import { MockStorage } from "../../../__tests__/webextension.mock";

import {
  AesGcmEncryptedStorage,
  AesGcmEncryptedValue,
} from "../EncryptedStorage";

const generateKey = async () =>
  await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
const [key1, key2] = await Promise.all([generateKey(), generateKey()]);

describe("EncryptedStorage", () => {
  const storage = new MockStorage();
  const estorage = new AesGcmEncryptedStorage({
    id: "default",
    key: key1,
    storage,
  });

  beforeEach(() => {
    storage.mockClear();
  });

  test("get(string) returns set value", async () => {
    await estorage.set({ foo: { bar: true } });
    const result = await estorage.get("foo");
    expect(result).toEqual({ foo: { bar: true } });
  });

  test("get(array) returns set value", async () => {
    await estorage.set({ foo: { bar: true }, bar: 42, baz: "yes" });
    const result = await estorage.get(["bar", "baz"]);
    expect(result).toEqual({ bar: 42, baz: "yes" });
  });

  test("get(object) returns set value", async () => {
    await estorage.set({ foo: { bar: true }, bar: 42, baz: "yes" });
    const result = await estorage.get({ bar: undefined, baz: undefined });
    expect(result).toEqual({ bar: 42, baz: "yes" });
  });

  test("get(object) returns default values", async () => {
    await estorage.set({ foo: 42 });
    const result = await estorage.get({ foo: 1, bar: 2, baz: undefined });
    expect(result).toEqual({ foo: 42, bar: 2 });
    expect(Object.keys(result)).not.toContain("baz");
  });

  test("set() undefined leaves previous value", async () => {
    await estorage.set({ foo: 42 });
    await estorage.set({ foo: undefined });
    const result = await estorage.get("foo");
    expect(result).toEqual({ foo: 42 });
  });

  test("incorrect key cannot read values", async () => {
    const estorage2 = new AesGcmEncryptedStorage({
      id: "default",
      key: key2,
      storage,
    });

    await estorage.set({ foo: 42 });
    await expect(estorage2.get("foo")).rejects.toThrow(
      'Failed to decrypt value for "foo":',
    );
  });

  test("same key cannot read values from storage with different id", async () => {
    const estorage2 = new AesGcmEncryptedStorage({
      id: "other", // different id to estorage1
      key: key1, // same key as estorage1
      storage,
    });

    await estorage.set({ foo: 42 });
    await expect(estorage2.get("foo")).rejects.toThrow(
      'Failed to decrypt value for "foo":',
    );
  });

  test("value set for storage key cannot be read from another storage key", async () => {
    await estorage.set({ foo: 42 });

    const encryptedFoo = (await storage.get("foo")).foo as AesGcmEncryptedValue;
    expect(Object.keys(encryptedFoo).toSorted()).toEqual(["ciphertext", "iv"]);

    await storage.set({ bar: encryptedFoo });
    await expect(estorage.get("bar")).rejects.toThrow(
      'Failed to decrypt value for "bar":',
    );
  });

  test("get() reports invalid stored data", async () => {
    await storage.set({ foo: { unrelated: true } });
    await expect(estorage.get("foo")).rejects.toThrow(
      'Encrypted value for "foo" is invalid',
    );
  });

  test("get() does not decrypt manipulated iv", async () => {
    await estorage.set({ foo: 42 });
    const { iv, ciphertext } = (await storage.get("foo"))
      .foo as AesGcmEncryptedValue;
    await storage.set({
      foo: {
        iv: `0x${iv.substring(2, 4) === "ff" ? "00" : "ff"}${iv.substring(4)}`,
        ciphertext,
      },
    });
    await expect(estorage.get("foo")).rejects.toThrow(
      'Failed to decrypt value for "foo":',
    );
  });

  test("get() does not decrypt manipulated ciphertext", async () => {
    await estorage.set({ foo: 42 });
    const { iv, ciphertext: ct } = (await storage.get("foo"))
      .foo as AesGcmEncryptedValue;
    await storage.set({
      foo: {
        ciphertext: `0x${
          ct.substring(2, 4) === "ff" ? "00" : "ff"
        }${ct.substring(4)}`,
        iv,
      },
    });
    await expect(estorage.get("foo")).rejects.toThrow(
      'Failed to decrypt value for "foo":',
    );
  });
});
