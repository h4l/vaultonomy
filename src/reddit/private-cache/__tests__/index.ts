import { jest } from "@jest/globals";

import { MockStorage } from "../../../__tests__/webextension.mock";

import { OnCreatedHandler } from "..";
import { log } from "../../../logging";
import { HexString } from "../../../types";
import { AesGcmEncryptedValue } from "../EncryptedStorage";
import {
  DatabaseError,
  DeleteDatabaseError,
  OpenDatabaseError,
  ReadDatabaseError,
  WebKeyError,
  WriteDatabaseError,
} from "../webKeys";

type ExtensionKeys = typeof import("../extensionKeys");
type WebKeys = typeof import("../webKeys");

jest.unstable_mockModule(
  "./src/reddit/private-cache/extensionKeys",
  (): ExtensionKeys => ({
    getWrappedDataKey: jest.fn<ExtensionKeys["getWrappedDataKey"]>(),
    setWrappedDataKey: jest.fn<ExtensionKeys["setWrappedDataKey"]>(),
  }),
);
jest.unstable_mockModule(
  "./src/reddit/private-cache/webKeys",
  (): WebKeys => ({
    DatabaseError,
    DeleteDatabaseError,
    OpenDatabaseError,
    ReadDatabaseError,
    WebKeyError,
    WriteDatabaseError,
    getWrappingKey: jest.fn<WebKeys["getWrappingKey"]>(),
    setWrappingKey: jest.fn<WebKeys["setWrappingKey"]>(),
    deleteVaultonomyIndexedDB: jest.fn<WebKeys["deleteVaultonomyIndexedDB"]>(),
  }),
);

const storage = new MockStorage();
jest.unstable_mockModule("./src/webextension", () => {
  return {
    browser: {
      storage: { local: storage },
    },
  };
});

const extensionKeys = await import("../extensionKeys");
const webKeys = await import("../webKeys");
const { getPrivateCache } = await import("..");

let wrappedDataKey: `0x${string}` | undefined;
let wrappingKey: Error | CryptoKey | undefined;

beforeEach(() => {
  wrappedDataKey = undefined;
  wrappingKey = undefined;

  jest
    .mocked(extensionKeys.getWrappedDataKey)
    .mockImplementation(async () => wrappedDataKey);
  jest
    .mocked(extensionKeys.setWrappedDataKey)
    .mockImplementation(async (wdk) => {
      wrappedDataKey = wdk;
    });

  jest.mocked(webKeys.getWrappingKey).mockImplementation(async () => {
    if (wrappingKey instanceof Error)
      throw new ReadDatabaseError(`${wrappingKey}`);
    return wrappingKey;
  });
  jest.mocked(webKeys.setWrappingKey).mockImplementation(async (key) => {
    if (wrappingKey instanceof Error)
      throw new WriteDatabaseError(`${wrappingKey}`);
    wrappingKey = key;
  });
  jest
    .mocked(webKeys.deleteVaultonomyIndexedDB)
    .mockImplementation(async () => {
      if (wrappingKey instanceof Error)
        throw new DeleteDatabaseError(`${wrappingKey}`);
      wrappingKey = undefined;
    });

  jest.spyOn(log, "debug").mockImplementation(() => {});
  jest.spyOn(log, "error").mockImplementation(() => {});
});

describe("getPrivateCache()", () => {
  test("calls onCreated on first use", async () => {
    const onCreated = jest.fn<OnCreatedHandler>();
    const cache = await getPrivateCache({ id: "foo", onCreated });
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenLastCalledWith({ cache, storage: storage });
  });

  test("generates keys on first use", async () => {
    await getPrivateCache({ id: "foo" });

    expect(extensionKeys.getWrappedDataKey).toHaveBeenCalledTimes(1);
    expect(webKeys.getWrappingKey).toHaveBeenCalledTimes(1);
    expect(extensionKeys.setWrappedDataKey).toHaveBeenCalledTimes(1);
    expect(webKeys.setWrappingKey).toHaveBeenCalledTimes(1);
  });

  test("stores encrypted values", async () => {
    const cache = await getPrivateCache({ id: "foo" });
    await cache.set({ thing: { data: 123 } });
    const got = await cache.get("thing");

    expect(got).toStrictEqual({ thing: { data: 123 } });

    const thing = (await storage.get("thing")).thing as AesGcmEncryptedValue;
    expect(Object.keys(thing).toSorted()).toEqual(["ciphertext", "iv"]);
  });

  abstract class Disruption {
    get name(): string {
      return this.constructor.name;
    }
    toString() {
      return this.name;
    }
    abstract disrupt(): Promise<void>;
    async checkRecovery(): Promise<void> {}
  }

  class UserClearsWebStorageDisruption extends Disruption {
    async disrupt(): Promise<void> {
      // user clears web storage (leaving the wrapped extension key set)
      wrappingKey = undefined;
    }
  }

  class UserCorruptsWebStorageDisruption extends Disruption {
    async disrupt(): Promise<void> {
      // unexpected value stored in db
      wrappingKey = { lol: "oops" } as unknown as CryptoKey;
    }
  }

  class UserCorruptsExtensionStorageDisruption extends Disruption {
    async disrupt(): Promise<void> {
      // unexpected value stored in extension storage
      wrappedDataKey = wrappedDataKey?.replaceAll(/[a-fA-F0-9]/g, "f") as
        | HexString
        | undefined;
    }
  }

  class IndexedDBBrokenUntilDeletedDisruption extends Disruption {
    async disrupt(): Promise<void> {
      // indexedDB get / set throw until delete is called
      wrappingKey = new Error("broken");
      jest
        .mocked(webKeys.deleteVaultonomyIndexedDB)
        .mockImplementationOnce(async () => {
          wrappingKey = undefined;
        });
    }
    async checkRecovery(): Promise<void> {
      // eslint-disable-next-line jest/no-standalone-expect
      expect(webKeys.deleteVaultonomyIndexedDB).toHaveBeenCalledTimes(1);
    }
  }

  test.each([
    new UserClearsWebStorageDisruption(),
    new UserCorruptsWebStorageDisruption(),
    new UserCorruptsExtensionStorageDisruption(),
    new IndexedDBBrokenUntilDeletedDisruption(),
  ])(
    "lifecycle — automatically re-generates deleted/broken keys: %s",
    async (disruption: Disruption) => {
      const onCreated = jest
        .fn<OnCreatedHandler>()
        .mockImplementation(async ({ storage }) => {
          // clean up on re-create
          storage.remove;
          await storage.remove("thing");
        });
      const getCache = async () =>
        await getPrivateCache({ id: "foo", onCreated });

      const cache1 = await getCache();
      await cache1.set({ thing: { data: 123 } });

      expect(onCreated).toHaveBeenCalledTimes(1);
      expect(extensionKeys.getWrappedDataKey).toHaveBeenCalledTimes(1);
      expect(webKeys.getWrappingKey).toHaveBeenCalledTimes(1);
      expect(extensionKeys.setWrappedDataKey).toHaveBeenCalledTimes(1);
      expect(webKeys.setWrappingKey).toHaveBeenCalledTimes(1);

      // A new cache instance re-unwraps the keys and has access to
      // previously-stored values.
      const cache2 = await getCache();
      expect(await cache2.get("thing")).toStrictEqual({ thing: { data: 123 } });

      expect(onCreated).toHaveBeenCalledTimes(1);
      expect(extensionKeys.getWrappedDataKey).toHaveBeenCalledTimes(2);
      expect(webKeys.getWrappingKey).toHaveBeenCalledTimes(2);
      expect(extensionKeys.setWrappedDataKey).toHaveBeenCalledTimes(1);
      expect(webKeys.setWrappingKey).toHaveBeenCalledTimes(1);

      // something breaks the key storage
      await disruption.disrupt();

      const cache3 = await getCache();

      await disruption.checkRecovery();

      // cache was cleared and keys re-generated
      expect(onCreated).toHaveBeenCalledTimes(2);
      expect(await cache3.get("thing")).toStrictEqual({});

      // storage is usable again
      await cache3.set({ thing: { data: 456 } });
      expect(await cache3.get("thing")).toStrictEqual({ thing: { data: 456 } });
    },
  );
});
