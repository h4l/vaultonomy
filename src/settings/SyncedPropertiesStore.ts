import { Emitter, createNanoEvents } from "nanoevents";
import { z } from "zod";

import { log as _log } from "../logging";
import { browser } from "../webextension";

const log = _log.getLogger("settings/SyncedPropertiesStore");

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
 */
export class SyncedPropertiesStore<PropertiesSchemaT extends z.ZodObject<any>> {
  readonly emitter: Emitter<{
    propertiesChanged: (
      properties: Partial<z.infer<PropertiesSchemaT>>,
    ) => void;
  }> = createNanoEvents();

  readonly schema: PropertiesSchemaT;
  readonly defaultProperties: () => z.infer<PropertiesSchemaT>;
  readonly keyPrefix: string;

  private partialSchema: z.ZodObject<any>;

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
    for (const key in result.data) {
      if (result.data[key] === undefined) delete result.data[key];
    }
    if (Object.keys(result.data).length === 0) return;
    log.debug("SyncedPropertiesStore propertiesChanged", result.data);
    this.emitter.emit("propertiesChanged", result.data);
  }

  #isStarted: boolean = false;
  start() {
    if (this.#isStarted) return;
    this.#isStarted = true;

    browser.storage.sync.onChanged.addListener(this.onSyncStorageChanged);
  }

  stop() {
    if (!this.#isStarted) return;
    this.#isStarted = false;

    browser.storage.sync.onChanged.removeListener(this.onSyncStorageChanged);
  }

  async getProperties(): Promise<z.infer<PropertiesSchemaT>> {
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
    const parsed = this.partialSchema.parse(properties);
    const stored = Object.fromEntries(
      Object.entries(parsed).flatMap(([k, v]) => {
        if (v === undefined) return [];
        return [[`${this.keyPrefix}${k}`, v]];
      }),
    );
    log.debug("set properties", stored);
    await browser.storage.sync.set(stored);
  }
}
