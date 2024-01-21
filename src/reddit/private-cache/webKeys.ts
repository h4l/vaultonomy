import { VaultonomyError } from "../../VaultonomyError";
import { assert } from "../../assert";
import { log } from "../../logging";

const storeNames = { keys: "keys" } as const;
const keyNames = { wrapping: "wrapping" } as const;
const idb = { name: "vaultonomy", version: 1 } as const;

export class WebKeyError extends VaultonomyError {}
export class DatabaseError extends WebKeyError {}
export class OpenDatabaseError extends DatabaseError {}
export class ReadDatabaseError extends DatabaseError {}
export class WriteDatabaseError extends DatabaseError {}
export class DeleteDatabaseError extends DatabaseError {}

function getEventError(event: Event): Error | undefined {
  const error = (event.target as { error?: unknown }).error;
  if (error instanceof Error) return error;
  return undefined;
}

async function openVaultonomyIndexedDB(): Promise<IDBDatabase> {
  try {
    const dbReq = indexedDB.open(idb.name, idb.version);
    dbReq.onupgradeneeded = (event) => {
      assert(event.oldVersion === 0);
      assert(event.newVersion === idb.version);
      const db = dbReq.result;
      db.createObjectStore(storeNames.keys);
    };
    return await new Promise<IDBDatabase>((resolve, reject) => {
      dbReq.onerror = (event) => {
        reject(getEventError(event));
      };
      dbReq.onsuccess = () => resolve(dbReq.result);
    });
  } catch (cause) {
    throw new OpenDatabaseError(
      `Failed to open database ${idb.name}: ${cause}`,
      { cause },
    );
  }
}

export async function deleteVaultonomyIndexedDB(): Promise<void> {
  try {
    return await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(idb.name);
      req.onerror = (event) => reject(getEventError(event));
      req.onsuccess = () => resolve();
    });
  } catch (cause) {
    new DeleteDatabaseError(`Failed to delete database ${idb.name}: cause`, {
      cause,
    });
  }
}

export async function getWrappingKey(): Promise<CryptoKey | undefined> {
  const db = await openVaultonomyIndexedDB();
  try {
    return await new Promise((resolve, reject) => {
      db.onerror = (event) => reject(getEventError(event));

      const tx = db.transaction(storeNames.keys, "readonly");
      const keysStore = tx.objectStore(storeNames.keys);

      const getReq = keysStore.get(keyNames.wrapping);
      getReq.onsuccess = () => {
        if (getReq.result instanceof CryptoKey) {
          resolve(getReq.result);
          return;
        }
        if (getReq.result !== undefined) {
          log.error(
            `unexpected value stored for ${keyNames.wrapping} key`,
            getReq.result,
          );
        }
        resolve(undefined);
      };
    });
  } catch (cause) {
    throw new ReadDatabaseError(
      `Failed to get ${keyNames.wrapping} key: ${cause}`,
      { cause },
    );
  } finally {
    db.close();
  }
}

export async function setWrappingKey(key: CryptoKey): Promise<void> {
  const db = await openVaultonomyIndexedDB();
  try {
    return await new Promise((resolve, reject) => {
      db.onerror = (event) => reject(getEventError(event));

      const tx = db.transaction(storeNames.keys, "readwrite");
      const keysStore = tx.objectStore(storeNames.keys);

      const putReq = keysStore.put(key, keyNames.wrapping);
      putReq.onsuccess = () => resolve();
    });
  } catch (cause) {
    throw new WriteDatabaseError(
      `Failed to set ${keyNames.wrapping} key: ${cause}`,
      { cause },
    );
  } finally {
    db.close();
  }
}
