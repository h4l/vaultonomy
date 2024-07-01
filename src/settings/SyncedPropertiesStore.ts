import type { DebouncedFunc } from "lodash";
import { default as debounce } from "lodash.debounce";
import { Emitter, createNanoEvents } from "nanoevents";
import { z } from "zod";

import { log as _log } from "../logging";
import { browser } from "../webextension";

const log = _log.getLogger("settings/SyncedPropertiesStore");

type ZodPartialObject<
  T extends z.ZodObject<S>,
  S extends z.ZodRawShape = T["shape"],
> = z.ZodObject<{
  [k in keyof S]: z.ZodOptional<S[k]>;
}>;

/**
 * Read/Write/Observe changes in a set of prefixed keys in browser.storage.sync.
 *
 * This is used to store and sync user preferences between browsers. Individual
 * settings are stored as different top-level keys in browser.storage.sync, as
 * browsers sync changes to distinct keys but don't attempt to deep merge
 * objects.
 *
 * We prefix stored keys to avoid conflicts with other data stored in
 * browser.storage.sync.
 *
 * Writes to storage are rate-limited to prevent users triggering synced storage
 * write limits.
 */
export class SyncedPropertiesStore<
  PropertiesSchemaT extends z.ZodObject<Shape>,
  Shape extends z.ZodRawShape = PropertiesSchemaT["shape"],
> {
  readonly emitter: Emitter<{
    propertiesChanged: (
      properties: Partial<z.infer<PropertiesSchemaT>>,
    ) => void;
  }> = createNanoEvents();

  readonly schema: PropertiesSchemaT;
  readonly defaultProperties: () => z.infer<PropertiesSchemaT>;
  readonly keyPrefix: string;

  private partialSchema: ZodPartialObject<PropertiesSchemaT>;

  // Writes to the synced storage are throttled at a level that the user can
  // hit using command shortcuts. To prevent the user triggering the limits, we
  // cache data in-memory and flush to the synced storage with a delay, using
  // debounce to merge writes that happen close together.

  /** The cache holds un-prefixed entries. */
  private cache: Partial<z.infer<PropertiesSchemaT>> | undefined;
  private syncCacheSoon: DebouncedFunc<() => void>;

  constructor({
    schema,
    defaultProperties,
    keyPrefix,
  }: {
    schema: PropertiesSchemaT;
    defaultProperties: () => z.infer<PropertiesSchemaT>;
    keyPrefix: string;
  }) {
    this.schema = schema;
    this.defaultProperties = defaultProperties;
    this.keyPrefix = keyPrefix;

    this.partialSchema = this.schema.partial();
    this.onSyncStorageChanged = this.onSyncStorageChanged.bind(this);

    this.syncCacheSoon = debounce(this.syncCacheToStorage.bind(this), 5000, {
      leading: false,
      trailing: true,
    });
  }

  get isStarted(): boolean {
    return this.#isStarted;
  }

  private onSyncStorageChanged(rawChanges: {
    [key: string]: chrome.storage.StorageChange;
  }): void {
    const changedValues = Object.fromEntries(
      Object.entries(rawChanges).flatMap(([k, c]) => {
        if (!k.startsWith(this.keyPrefix)) return [];
        return [[k.substring(this.keyPrefix.length), c.newValue]];
      }),
    );
    const result = this.partialSchema.safeParse(changedValues);
    if (!result.success) return;

    const changes = this.updateCache(result.data);

    log.debug("SyncedPropertiesStore propertiesChanged", changes);
    if (Object.keys(changes).length === 0) return;
    log.debug("propertiesChanged from storage.sync.onChanged", changes);
    this.emitter.emit("propertiesChanged", result.data);
    // Note: we don't need to call syncCacheSoon() as the changes are already in
    // storage.sync.
  }

  #isStarted: boolean = false;
  start() {
    if (this.#isStarted) return;
    this.#isStarted = true;

    browser.storage.sync.onChanged.addListener(this.onSyncStorageChanged);
  }

  stop() {
    if (!this.#isStarted) return;
    this.syncCacheSoon.flush();
    this.#isStarted = false;

    browser.storage.sync.onChanged.removeListener(this.onSyncStorageChanged);
  }

  async getProperties(): Promise<z.infer<PropertiesSchemaT>> {
    const properties = { ...(await this.readFromStorage()) };

    for (const key in this.cache) {
      const value: undefined | z.infer<PropertiesSchemaT>[typeof key] =
        this.cache[key];
      if (value !== undefined) properties[key] = value;
    }

    log.debug("getProperties", properties);
    return properties;
  }

  private async readFromStorage(): Promise<z.infer<PropertiesSchemaT>> {
    const keys = Object.keys(this.schema.shape).map(
      (k) => `${this.keyPrefix}${k}`,
    );
    const stored = Object.fromEntries(
      Object.entries(await browser.storage.sync.get(keys)).flatMap(([k, v]) => {
        if (!k.startsWith(this.keyPrefix)) return [];
        return [[k.substring(this.keyPrefix.length), v]];
      }),
    );
    const parsed = this.partialSchema.parse(stored);
    for (const key of keys) if (parsed[key] === undefined) delete parsed[key];
    return { ...this.defaultProperties(), ...parsed };
  }

  async setProperties(
    properties: Partial<z.infer<PropertiesSchemaT>>,
  ): Promise<void> {
    const changes = this.updateCache(properties);
    this.syncCacheSoon();
    if (Object.keys(changes).length === 0) return;
    log.debug("propertiesChanged from setProperties", changes);
    this.emitter.emit("propertiesChanged", changes);
  }

  private updateCache(
    properties: Partial<z.infer<PropertiesSchemaT>>,
  ): Partial<z.infer<PropertiesSchemaT>> {
    if (this.cache === undefined) this.cache = {};
    const parsed = this.partialSchema.parse(properties);

    const changes = Object.entries(parsed).flatMap(([k, v]) => {
      if (v === undefined || this.cache![k] === v) return [];
      return [[k, v]];
    });
    log.debug("set properties", properties, "changes:", changes);
    if (changes.length === 0) return {};
    const changesObject = Object.fromEntries(changes);
    Object.assign(this.cache, changesObject);
    return changesObject;
  }

  private syncCacheToStorage(): void {
    this.#syncCacheToStorage()
      .then((changes) => {
        log.debug("synced cache to storage.sync, changes:", changes);
      })
      .catch((error) => {
        log.error("failed to sync cache to storage.sync", error);
      });
  }

  async #syncCacheToStorage(): Promise<Partial<z.infer<PropertiesSchemaT>>> {
    if (this.cache === undefined) return {};

    const stored = await this.readFromStorage();
    const changes: Partial<z.infer<PropertiesSchemaT>> = {};
    for (const key in this.cache) {
      const cacheValue = this.cache[key];
      if (cacheValue === undefined || cacheValue === stored[key]) continue;
      changes[`${this.keyPrefix}${key}`] = cacheValue;
    }

    await browser.storage.sync.set(changes);
    return changes;
  }
}
