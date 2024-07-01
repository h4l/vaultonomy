import { StateStorage, createJSONStorage } from "zustand/middleware";

import { StorageAreaGetSetRemove } from "../../webextension";
import { ExtensionAsyncStorage } from "./ExtensionAsyncStorage";

/**
 * zustand StateStorage that reads/writes a web extension chrome.storage.StorageArea.
 */
export function extensionStateStorage(
  storageArea: StorageAreaGetSetRemove,
): StateStorage {
  return new ExtensionAsyncStorage(storageArea);
}

/**
 * zustand PersistentStorage that reads/writes a web extension
 * chrome.storage.StorageArea.
 */
export function createExtensionStorage<T>(
  storageArea: StorageAreaGetSetRemove,
) {
  // This is somewhat inefficient as we have two layers of JSON serialisation —
  // zustand's JSONStorage serialises store state to JSON before passing it to
  // our StateStorage impl, which writes the already-JSON string to extension
  // storage, which also serialises as JSON.
  //
  // We could implement this more efficiently by writing the partial store data
  // directly to the extension storage, but there's probably no point
  // considering the small amount of UI state we store in this way.
  return createJSONStorage<T>(() => extensionStateStorage(storageArea));
}
