import { bytesToHex, hexToBytes } from "viem";
import { z } from "zod";
import { ZodError } from "zod";

import { VaultonomyError } from "../../VaultonomyError";
import { HexString } from "../../types";
import { StorageAreaGetSetRemove } from "../../webextension";

export class EncryptedStorageError extends VaultonomyError {}

export class InvalidStoredValueError extends EncryptedStorageError {
  key: string;
  zodError: ZodError;
  constructor(
    message: string,
    {
      key,
      zodError,
      ...options
    }: { key: string; zodError: ZodError } & ErrorOptions,
  ) {
    super(message, options);
    this.key = key;
    this.zodError = zodError;
  }
}

export class DecryptionError extends EncryptedStorageError {
  key: string;
  constructor(
    message: string,
    { key, ...options }: { key: string } & ErrorOptions,
  ) {
    super(message, options);
    this.key = key;
  }
}

export abstract class EncryptedStorage<
  Encrypted extends z.ZodTypeAny,
  E extends z.infer<Encrypted> = z.infer<Encrypted>,
> implements StorageAreaGetSetRemove
{
  storage: StorageAreaGetSetRemove;
  encryptedSchema: Encrypted;
  #encoder = new TextEncoder();
  #decoder = new TextDecoder();

  constructor({
    storage,
    encryptedSchema,
  }: {
    storage: StorageAreaGetSetRemove;
    encryptedSchema: Encrypted;
  }) {
    this.storage = storage;
    this.encryptedSchema = encryptedSchema;
  }
  async remove(keys: string | string[]): Promise<void> {
    return await this.storage.remove(keys);
  }

  abstract encryptFromBytes(value: Uint8Array, key: string): Promise<E>;
  abstract decryptToBytes(encrypted: E, key: string): Promise<Uint8Array>;

  async get(
    keys?: string | string[] | { [key: string]: any } | null | undefined,
  ): Promise<{ [key: string]: any }> {
    if (keys === undefined || keys === null) return {};

    let defaults: Record<string, unknown>;
    if (typeof keys === "string") {
      defaults = { [keys]: undefined };
    } else if (Array.isArray(keys)) {
      defaults = Object.fromEntries(keys.map((key) => [key, undefined]));
    } else {
      defaults = keys;
    }

    const rawEncryptedItems = Object.entries(
      await this.storage.get(Object.keys(defaults)),
    ).filter(([key, _]) => key !== undefined);

    const parsedEncryptedItems: [string, E][] = rawEncryptedItems.map(
      ([key, raw]) => {
        const parsed = this.encryptedSchema.safeParse(raw);
        if (!parsed.success) {
          throw new InvalidStoredValueError(
            `Encrypted value for ${JSON.stringify(key)} is invalid`,
            { key, zodError: parsed.error },
          );
        }
        return [key, parsed.data as E];
      },
    );
    const decryptedItems: Record<string, unknown> = Object.fromEntries(
      await Promise.all(
        parsedEncryptedItems.map(async ([key, encryptedValue]) => {
          let decryptedJson;
          try {
            decryptedJson = await this.decryptToBytes(encryptedValue, key);
          } catch (cause) {
            throw new DecryptionError(
              `Failed to decrypt value for ${JSON.stringify(key)}: ${cause}`,
              { key, cause },
            );
          }
          try {
            return [key, JSON.parse(this.#decoder.decode(decryptedJson))];
          } catch (cause) {
            // Can only happen due to an internal bug, because encryption is
            // authenticated.
            throw new EncryptedStorageError(
              `Failed to parse decrypted value JSON for ${JSON.stringify(key)}`,
              { cause },
            );
          }
        }),
      ),
    );

    const values: Record<string, unknown> = {};
    for (const key in defaults) {
      const value = decryptedItems[key] ?? defaults[key];
      if (value !== undefined) values[key] = value;
    }
    return values;
  }

  async set(items: { [key: string]: any }): Promise<void> {
    const encryptedEntries = await Promise.all(
      Object.entries(items)
        .filter(([_key, value]) => value !== undefined)
        .map(async ([key, value]) => {
          const valueBytes = this.#encoder.encode(JSON.stringify(value));
          return [key, await this.encryptFromBytes(valueBytes, key)];
        }),
    );

    const encryptedItems = Object.fromEntries(encryptedEntries);
    return await this.storage.set(encryptedItems);
  }
}

const AesGcmEncryptedValue = z.object({
  iv: HexString,
  ciphertext: HexString,
});
type AesGcmEncryptedValue = z.infer<typeof AesGcmEncryptedValue>;

export class AesGcmEncryptedStorage extends EncryptedStorage<
  typeof AesGcmEncryptedValue
> {
  public readonly id: string;
  public readonly key: CryptoKey;
  #encoder: TextEncoder = new TextEncoder();
  constructor({
    id,
    key,
    storage,
  }: {
    id: string;
    key: CryptoKey;
    storage: StorageAreaGetSetRemove;
  }) {
    super({ encryptedSchema: AesGcmEncryptedValue, storage });
    this.id = id;
    this.key = key;
  }

  private getAdditionalData(key: string): Uint8Array {
    // We include additional context as additionalData when
    // encrypting/decrypting so that encrypted values can't be decrypted
    // successfully in a different context. E.g. someone can't take one key's
    // value and write it to another key and have us decrypt it successfully,
    // because the additionalData won't match after moving it.
    return this.#encoder.encode(
      JSON.stringify(["AesGcmEncryptedStorage", this.id, key]),
    );
  }

  async encryptFromBytes(
    value: Uint8Array,
    key: string,
  ): Promise<{ iv: string; ciphertext: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv, additionalData: this.getAdditionalData(key) },
      this.key,
      value,
    );
    return {
      iv: bytesToHex(iv),
      ciphertext: bytesToHex(new Uint8Array(ciphertext)),
    };
  }

  async decryptToBytes(
    {
      iv: hexIv,
      ciphertext: hexCiphertext,
    }: {
      iv: string;
      ciphertext: string;
    },
    key: string,
  ): Promise<Uint8Array> {
    const iv = hexToBytes(hexIv as `0x${string}`);
    const ciphertext = hexToBytes(hexCiphertext as `0x${string}`);
    return new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData: this.getAdditionalData(key) },
        this.key,
        ciphertext,
      ),
    );
  }
}
