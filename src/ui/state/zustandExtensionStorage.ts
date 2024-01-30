import { StateStorage, createJSONStorage } from "zustand/middleware";

import { assert } from "../../assert";
import { StorageAreaGetSetRemove, browser } from "../../webextension";

/**
 * zustand StateStorage that reads/writes a web extension chrome.storage.StorageArea.
 */
export function extensionStateStorage(
  storageArea: StorageAreaGetSetRemove,
): StateStorage {
  return {
    async getItem(name) {
      const result = await storageArea.get(name);
      return result[name] ?? null;
    },
    async setItem(name, value) {
      await storageArea.set({ [name]: value });
    },
    async removeItem(name) {
      await storageArea.remove(name);
    },
  };
}

/**
 * zustand PersistentStorage that reads/writes a web extension
 * chrome.storage.StorageArea.
 */
export function createExtensionStorage<T>(
  storageArea: StorageAreaGetSetRemove,
) {
  // This is somewhat ineficient as we have two layers of JSON serialisation —
  // zustand's JSONStorage serialises store state to JSON before passing it to
  // our StateStorage impl, which writes the already-JSON string to extension
  // storage, which also serialises as JSON.
  //
  // We could implement this more efficiently by writing the partial store data
  // directly to the extension storage, but there's probably no point
  // considering the small amount of UI state we store in this way.
  return createJSONStorage<T>(() => extensionStateStorage(storageArea));
}
