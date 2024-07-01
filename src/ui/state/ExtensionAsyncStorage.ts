import { AsyncStorage } from "@tanstack/react-query-persist-client";
import { StateStorage } from "zustand/middleware";

import { log } from "../../logging";
import { StorageAreaGetSetRemove } from "../../webextension";

// Happily, zustand and tanstack-query's async storage interface is the same 🎉
export class ExtensionAsyncStorage implements AsyncStorage, StateStorage {
  constructor(private storageArea: StorageAreaGetSetRemove) {}
  async getItem(name: string): Promise<string | null> {
    const result = (await this.storageArea.get(name))[name];
    // webextension storage can hold any JSON value, but zustand/tanstack-query
    // do their own serialisation and expect storage to write strings.
    if (typeof result !== "string") {
      if (result) {
        log.error(
          "Unexpected non-string value in zustand storage, value will be ignored",
          result,
        );
      }
      return null;
    }
    return result;
  }
  async setItem(name: string, value: string) {
    await this.storageArea.set({ [name]: value });
  }
  async removeItem(name: string) {
    await this.storageArea.remove(name);
  }
}
