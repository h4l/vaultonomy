import { JSONRPCErrorException } from "json-rpc-2.0";

import { log } from "../logging";
import {
  IUserPageDataCache,
  createPrivateUserPageDataCache,
} from "./UserPageDataCache";
import { PageData, UserPageData, fetchPageData } from "./page-data";
import { ErrorCode } from "./reddit-interaction-spec";

const SESSION_EXPIRY_SLOP = 1000 * 60 * 5;
const LOGGED_OUT_LIFETIME = 1000 * 5;

export function createCachedSessionManager(): SessionManager {
  return new SessionManager(createPrivateUserPageDataCache());
}

// TODO: detect user log out automatically?
export class SessionManager {
  /** The in-memory cache of the most recent page data response. */
  private cachedPageData: Promise<PageData> | undefined;
  private freshUntil: WeakMap<Promise<PageData>, number> = new WeakMap();
  constructor(private readonly cache: IUserPageDataCache) {}

  private async loadPageData(): Promise<PageData> {
    const cachedSession = await this.cache.getUserSession();
    if (cachedSession && !isExpired(cachedSession)) return cachedSession;

    return await fetchPageData();
  }

  private expireAfter(
    cachedPageData: Promise<PageData>,
    expiredAfter: number,
  ): void {
    const freshUntil = this.getFreshUntil(cachedPageData);
    if (expiredAfter < freshUntil) {
      this.freshUntil.set(cachedPageData, expiredAfter);
    }
  }

  private getFreshUntil(cachedPageData: Promise<PageData>): number {
    return this.freshUntil.get(cachedPageData) ?? Number.MAX_SAFE_INTEGER;
  }

  private isFresh(
    cachedPageData?: Promise<PageData>,
  ): cachedPageData is Promise<PageData> {
    return !!cachedPageData && Date.now() <= this.getFreshUntil(cachedPageData);
  }

  private async registerPostLoadPageDataActions(
    loadingPageData: Promise<PageData>,
  ): Promise<void> {
    let pageData: PageData;
    try {
      pageData = await loadingPageData;
    } catch (error) {
      log.error("Failed to load Reddit page for session data:", error);
      // Mark the failed request as expired so that subsequent requests won't
      // re-use it.
      this.expireAfter(loadingPageData, 0);
      return;
    }

    if (pageData.loggedIn) {
      this.expireAfter(
        loadingPageData,
        pageData.auth.expires.getTime() - SESSION_EXPIRY_SLOP,
      );
      // Save user to persistent cache (if it's the latest successful response).
      // It should always be the latest, as we don't allow concurrent requests.
      if (this.cachedPageData === loadingPageData) {
        await this.cache.setUserSession(pageData);
      }
    } else {
      this.expireAfter(loadingPageData, Date.now() + LOGGED_OUT_LIFETIME);
    }
  }

  #pendingPageData: Promise<PageData> | undefined;
  async getPageData(): Promise<PageData> {
    // All calls share the same request if one is ongoing
    if (this.#pendingPageData === undefined) {
      const pending = this.getPageDataWithRetry();
      pending
        .catch(() => {})
        .finally(() => {
          if (this.#pendingPageData === pending)
            this.#pendingPageData = undefined;
        });
      this.#pendingPageData = pending;
    }
    return await this.#pendingPageData;
  }

  private async getPageDataWithRetry(): Promise<PageData> {
    let lastError: unknown;
    for (const delay of [0, 100, 1000]) {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        return await this.getPageDataWithoutRetry();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  private async getPageDataWithoutRetry(): Promise<PageData> {
    if (!this.isFresh(this.cachedPageData)) {
      this.cachedPageData = this.loadPageData();
      this.registerPostLoadPageDataActions(this.cachedPageData).catch(
        log.error,
      );
    }
    return await this.cachedPageData;
  }
}

function isExpired(sessionData: UserPageData): boolean {
  return Date.now() >= sessionData.auth.expires.getTime() - SESSION_EXPIRY_SLOP;
}
