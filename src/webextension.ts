// Use @types/chrome for the WebExtension API (rather than
// webextension-polyfill) as they're more accurate and we only want to use
// APIs that exist in Chrome.
interface WebExtensionGlobal {
  chrome?: typeof chrome;
  browser?: typeof chrome;
}

type PermissionsEvent = chrome.events.Event<
  (permissions: chrome.permissions.Permissions) => void
>;

export type WebExtensionAPI = typeof chrome & {
  permissions: {
    // @types/chrome lacks removeListener() for these
    onAdded: PermissionsEvent;
    onRemoved: PermissionsEvent;
  };
};

const webExtensionGlobal = globalThis as WebExtensionGlobal;
const _browser = webExtensionGlobal.browser ?? webExtensionGlobal.chrome;
if (!_browser) {
  throw new Error(
    "WebExtension API not found on browser or chrome properties of globalThis",
  );
}
export const browser = _browser as WebExtensionAPI;

/**
 * A minimal subset of the chrome.storage.StorageArea API.
 *
 * Just Promise-returning get and set methods.
 */
export type StorageAreaGetSetRemove = StorageAreaGet &
  StorageAreaSet &
  StorageAreaRemove;
export type StorageAreaSet = {
  /**
   * Sets multiple items.
   * @param items An object which gives each key/value pair to update storage with. Any other key/value pairs in storage will not be affected.
   * Primitive values such as numbers will serialize as expected. Values with a typeof "object" and "function" will typically serialize to {}, with the exception of Array (serializes as expected), Date, and Regex (serialize using their String representation).
   * @return A void Promise
   * @since MV3
   */
  set(items: { [key: string]: any }): Promise<void>;
};
export type StorageAreaGet = {
  /**
   * Gets one or more items from storage.
   * @param keys A single key to get, list of keys to get, or a dictionary specifying default values.
   * An empty list or object will return an empty result object. Pass in null to get the entire contents of storage.
   * @return A Promise that resolves with an object containing items
   * @since MV3
   */
  get(
    keys?: string | string[] | { [key: string]: any } | null,
  ): Promise<{ [key: string]: any }>;
};

export type StorageAreaClear = {
  /**
   * Removes all items from storage.
   * @return A void Promise
   * @since MV3
   */
  clear(): Promise<void>;
};

export type StorageAreaRemove = {
  /**
   * Removes one or more items from storage.
   * @param keys A single key or a list of keys for items to remove.
   * @param callback Optional.
   * @return A void Promise
   * @since MV3
   */
  remove(keys: string | string[]): Promise<void>;
};
