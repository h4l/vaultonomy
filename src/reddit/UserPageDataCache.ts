import { z } from "zod";

import { StorageAreaGetSetRemove } from "../webextension";
import { UserPageData } from "./page-data";
import { safeGetPrivateCache } from "./private-cache";

const SESSION_KEY = "reddit.session";

export const StoredUserPageData = z.object({
  requestedAt: z.number(),
  userPageData: UserPageData,
});
export type StoredUserPageData = z.infer<typeof StoredUserPageData>;

export interface IUserPageDataCache {
  getUserSession(): Promise<StoredUserPageData | undefined>;
  setUserSession(userSession: StoredUserPageData): Promise<void>;
  clear(): Promise<void>;
}

export function createPrivateUserPageDataCache(): IUserPageDataCache {
  const futureCache = (async () => {
    const cache = await safeGetPrivateCache({
      id: "reddit user session",
      async onCreated({ cache }) {
        await new UserPageDataCache(cache).clear();
      },
    });
    if (!cache) return undefined;
    return new UserPageDataCache(cache);
  })();
  return new AsyncUserPageDataCache(futureCache);
}

export class UserPageDataCache implements IUserPageDataCache {
  constructor(private readonly cache: StorageAreaGetSetRemove) {}

  async getUserSession(): Promise<StoredUserPageData | undefined> {
    try {
      const session = (await this.cache.get(SESSION_KEY))[SESSION_KEY];
      if (session === undefined) return undefined;
      return StoredUserPageData.parse(session);
    } catch (error) {
      console.error(
        `Failed to load ${SESSION_KEY} from cache as UserPageData. Resetting cache.`,
        error,
      );
      await this.clear();
    }
    return undefined;
  }

  async setUserSession(userSession: StoredUserPageData): Promise<void> {
    try {
      await this.cache.set({ [SESSION_KEY]: userSession });
    } catch (error) {
      console.error(`Failed to save user session to persistent cache: `, error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.cache.remove(SESSION_KEY);
    } catch (error) {
      console.error(`Failed to clear user session cache.`, error);
    }
  }
}

class AsyncUserPageDataCache implements IUserPageDataCache {
  constructor(
    private readonly userPageDataCache: Promise<UserPageDataCache | undefined>,
  ) {}

  async getUserSession(): Promise<StoredUserPageData | undefined> {
    return (await this.userPageDataCache)?.getUserSession();
  }
  async setUserSession(userSession: StoredUserPageData): Promise<void> {
    (await this.userPageDataCache)?.setUserSession(userSession);
  }
  async clear(): Promise<void> {
    (await this.userPageDataCache)?.clear();
  }
}
