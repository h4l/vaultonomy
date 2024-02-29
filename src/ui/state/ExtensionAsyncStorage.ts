import { AsyncStorage } from "@tanstack/react-query-persist-client";
import { StateStorage } from "zustand/middleware";

import { StorageAreaGetSetRemove } from "../../webextension";

// Happily, zustand and tanstack-query's async storage interface is the same 🎉
export class ExtensionAsyncStorage implements AsyncStorage, StateStorage {
  constructor(private storageArea: StorageAreaGetSetRemove) {}
  async getItem(name: string) {
    const result = await this.storageArea.get(name);
    return result[name] ?? null;
  }
  async setItem(name: string, value: string) {
    await this.storageArea.set({ [name]: value });
  }
  async removeItem(name: string) {
    await this.storageArea.remove(name);
  }
}
