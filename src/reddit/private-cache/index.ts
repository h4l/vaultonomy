// Fetching a user auth token from Reddit adds ~1-2 seconds onto the initial
// request when opening the extension. We'd like to cache it to avoid that,
// but to maintain a security boundary between our code running in the Reddit
// page and the code running outside, we can't write the auth token to extension
// storage. (If we did, all of the extension could read the auth token and make
// API requests.)
//
// Instead, we'll write the auth token extension storage, but we'll
// encrypt it using a key stored split between web and extension storage. With
// this arrangement:
//
//   - Encrypted data is only accessible to the extension (chrome.storage.local).
//   - The extension only has access to the wrapped (encrypted version of the)
//     data key.
//   - The web page & our content script have access to the wrapping key that
//     encrypts the data key.
//   - The web page has no access to the encrypted data or wrapped data key.
//   - Therefore only our content script has access to both the wrapping key,
//     the wrapped data key and the encrypted data.
//
// Perhaps a little OTT, but, security comes first!
import { fromHex, toHex } from "viem";

import { VaultonomyError } from "../../VaultonomyError";
import { log } from "../../logging";
import { withTimeout } from "../../timeout";
import { StorageAreaGetSetRemove, browser } from "../../webextension";
import { AesGcmEncryptedStorage } from "./EncryptedStorage";
import * as extensionKeys from "./extensionKeys";
import * as webKeys from "./webKeys";

type WrappingKey = { wrappingKey: CryptoKey };
type DataKey = { dataKey: CryptoKey };
type WrappingDataKeys = WrappingKey & DataKey;

const dataKeyAlgo = { name: "AES-GCM", length: 256 } as const;
const dataKeyUsage = ["encrypt", "decrypt"] as const;

export class PrivateCacheError extends VaultonomyError {}
export class BrokenIndexedDBPrivateCacheError extends PrivateCacheError {}

async function generateKeys(): Promise<WrappingDataKeys> {
  const _wrappingKey = crypto.subtle.generateKey(
    { name: "AES-KW", length: 256 },
    false, // this key is not exportable
    ["wrapKey", "unwrapKey"],
  );
  const _dataKey = crypto.subtle.generateKey(
    dataKeyAlgo,
    true, // we will export this key by wrapping it with the wrapping key
    dataKeyUsage,
  );
  const [wrappingKey, dataKey] = await Promise.all([_wrappingKey, _dataKey]);
  return { wrappingKey, dataKey };
}

type HexString = `0x${string}`;

async function wrapDataKey({
  wrappingKey,
  dataKey,
}: WrappingDataKeys): Promise<HexString> {
  const wrappedDataKey = await crypto.subtle.wrapKey(
    "raw",
    dataKey,
    wrappingKey,
    { name: "AES-KW" },
  );
  return toHex(new Uint8Array(wrappedDataKey));
}

async function unwrapDataKey({
  wrappedDataKey,
  wrappingKey,
}: { wrappedDataKey: HexString } & WrappingKey): Promise<CryptoKey> {
  const wrappedDataKeyBytes = fromHex(wrappedDataKey, "bytes");
  return await crypto.subtle.unwrapKey(
    "raw",
    wrappedDataKeyBytes,
    wrappingKey,
    "AES-KW",
    dataKeyAlgo,
    false, // not extractable — we only extract once when generating the key
    dataKeyUsage,
  );
}

async function getDataKey(): Promise<CryptoKey | undefined> {
  const [wrappingKey, wrappedDataKey] = await Promise.all([
    webKeys.getWrappingKey(),
    extensionKeys.getWrappedDataKey(),
  ]);
  if (wrappingKey === undefined || wrappedDataKey === undefined)
    return undefined;
  return await unwrapDataKey({ wrappedDataKey, wrappingKey });
}

async function generateAndSetKeys(): Promise<CryptoKey> {
  const { dataKey, wrappingKey } = await generateKeys();
  const wrappedDataKey = await wrapDataKey({ wrappingKey, dataKey });
  await Promise.all([
    webKeys.setWrappingKey(wrappingKey),
    extensionKeys.setWrappedDataKey(wrappedDataKey),
  ]);
  // return the newly-unwrapped key rather than the original dataKey, because
  // the unwrapped version is not extractable, and we never need to extract it
  // again after initially wrapping it to save.
  return await unwrapDataKey({ wrappedDataKey, wrappingKey });
}

type GetOrCreateResult =
  | { created: true; error?: unknown; key: CryptoKey }
  | { created: false; key: CryptoKey };

async function getOrCreateDataKey(options: {
  reCreateOnError?: boolean;
}): Promise<GetOrCreateResult> {
  const attemptGetOrCreateDataKey = async () => {
    options.reCreateOnError = options.reCreateOnError ?? false;
    let error: unknown = undefined;
    try {
      const key = await getDataKey();
      if (key) return { key, created: false };
    } catch (e) {
      error = e;
      if (!options.reCreateOnError) {
        throw new PrivateCacheError(
          `Failed to read and unwrap data key from storage: ${error}`,
          { cause: error },
        );
      } else {
        log.error("Failed to read and unwrap data key from storage.", error);
        // Assume the storage was messed up. Recover by re-creating key.
        // Clearing web page storage won't cause this (the key will be undefined),
        // so this shouldn't normally happen, but could if someone is playing with
        // indexedDB. Could be caused by a race condition when generating a new
        // key — say the web side's indexedDB persists but the extension storage
        // doesn't then the wrapping key wouldn't match the stored wrapped data
        // key.
      }
    }
    return { key: await generateAndSetKeys(), error, created: true };
  };

  try {
    return await attemptGetOrCreateDataKey();
  } catch (cause) {
    if (!options.reCreateOnError || !(cause instanceof webKeys.DatabaseError)) {
      throw cause;
    }
    log.error(
      "Failed to get/create keys due to an error interacting with our " +
        "indexedDB. Attempting to recover by deleting our indexedDB.",
      cause,
    );
    try {
      await webKeys.deleteVaultonomyIndexedDB();
      log.debug("Deleted broken indexedDB.");
      const result = await attemptGetOrCreateDataKey();
      log.debug(
        "Keys re-generated successfully — recovered from broken indexedDB.",
      );
      return result;
    } catch (cause) {
      throw new BrokenIndexedDBPrivateCacheError(
        `Failed to recover from unusable indexedDB by deleting and re-creating: ${cause}`,
        { cause },
      );
    }
  }
}

export type OnCreatedOptions = {
  cache: AesGcmEncryptedStorage;
  storage: typeof chrome.storage.local;
};
export type OnCreatedHandler = (options: OnCreatedOptions) => Promise<void>;

export type GetPrivateCacheOptions = {
  id: string;
  onCreated?: OnCreatedHandler;
};

/**
 * Get a storage chrome.browser.storage.local wrapper that encrypts values.
 *
 * Keys are not encrypted. The key used to encrypt values is auto-generated,
 * and intended for ephemeral, cached content, not persistent data. The key is
 * split between the web page's storage and the extension storage, such that
 * only the content script running in the web page has access to both parts.
 * So as long as the content script does not export the key or content, it can
 * remain private to the web page's content script.
 */
export async function getPrivateCache(
  options: GetPrivateCacheOptions,
): Promise<StorageAreaGetSetRemove> {
  const { id, onCreated } = options;
  const storage = browser.storage.local;
  const { key, created } = await getOrCreateDataKey({ reCreateOnError: true });
  const cache = new AesGcmEncryptedStorage({ id, key, storage });
  if (created && onCreated) await onCreated({ cache, storage });
  return cache;
}

const CACHE_LOAD_TIMEOUT = 500;

export async function safeGetPrivateCache(
  options: GetPrivateCacheOptions,
): Promise<StorageAreaGetSetRemove | undefined> {
  try {
    const load = await withTimeout(
      CACHE_LOAD_TIMEOUT,
      "getPrivateCache()",
      getPrivateCache(options),
    );
    if (load.timeout) {
      log.warn("Failed to load private cache due to timeout", load);
      return undefined;
    }
    return load.value;
  } catch (error) {
    log.error(
      `Failed to load private cache, ${options.id} will not be cached`,
      error,
    );
    return undefined;
  }
}
