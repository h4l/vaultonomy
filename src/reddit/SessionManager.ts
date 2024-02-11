import { assert } from "../assert";
import { log } from "../logging";
import {
  IUserPageDataCache,
  createPrivateUserPageDataCache,
} from "./UserPageDataCache";
import { PageData, UserPageData, fetchPageData } from "./page-data";

const LOGGED_OUT_LIFETIME = 1000;

export function createCachedSessionManager(): SessionManager {
  return new SessionManager(createPrivateUserPageDataCache());
}

type RequestOptions = { minFresh?: number; maxAge?: number; noCache?: boolean };

type PageDataResponse = {
  requestedAt: number;
  fromStore: boolean;
  fromCache: boolean;
  pageData: Promise<PageData>;
  freshUntil: number | undefined;
};

function createResponse({
  pageData,
  ...options
}: Partial<PageDataResponse> &
  Pick<PageDataResponse, "pageData">): PageDataResponse {
  return {
    requestedAt: options.requestedAt ?? Date.now(),
    fromStore: options.fromStore ?? false,
    fromCache: options.fromCache ?? false,
    pageData,
    freshUntil: options.freshUntil,
  };
}

function setFreshUntilFromAuthExpiry(
  response: PageDataResponse,
  pageData: UserPageData,
) {
  expireAfter(response, pageData.auth.expires.getTime());
}

export class SessionManager {
  /** The in-memory cache of the most recent page data response. */
  private loadedPageData: PageDataResponse | undefined;
  private loadingPageData: Promise<PageDataResponse> | undefined;

  constructor(private readonly cache: IUserPageDataCache) {}

  private async fetchPageDataFromStore(): Promise<
    PageDataResponse | undefined
  > {
    const cachedSession = await this.cache.getUserSession();
    if (!cachedSession) return undefined;
    const response = createResponse({
      pageData: Promise.resolve(cachedSession.userPageData),
      requestedAt: Math.min(Date.now(), cachedSession.requestedAt),
      fromStore: true,
      fromCache: true,
    });
    setFreshUntilFromAuthExpiry(response, cachedSession.userPageData);
    return response;
  }

  private async loadPageData(
    options: RequestOptions,
  ): Promise<PageDataResponse> {
    if (!options.noCache) {
      const cachedResponse = await this.fetchPageDataFromStore();
      if (cachedResponse && responseSatisfies(cachedResponse, options))
        return cachedResponse;
    }

    // We don't await pageData here, as it would block concurrent requests
    const pageData = fetchPageData();
    const response = createResponse({ pageData });
    this.registerPostLoadPageDataActions(response, pageData).catch(log.error);
    return response;
  }

  private async registerPostLoadPageDataActions(
    response: PageDataResponse,
    loadingPageData: Promise<PageData>,
  ): Promise<void> {
    let pageData: PageData;
    try {
      pageData = await loadingPageData;
    } catch (error) {
      log.error("Failed to load Reddit page for session data:", error);
      // Mark the failed request as expired so that subsequent requests won't
      // re-use it.
      expireAfter(response, 0);
      return;
    } finally {
      // Mark as in-memory cached from the next tick, so that concurrent
      // requests use this response if they don't accept cached responses.
      setTimeout(() => {
        response.fromCache = true;
      }, 0);
    }

    if (pageData.loggedIn) {
      setFreshUntilFromAuthExpiry(response, pageData);
      // Save this response (both in the persistent and in-memory cache) as the
      // current session if it was requested after the current loaded response.
      if ((this.loadedPageData?.requestedAt ?? 0) < response.requestedAt) {
        this.loadedPageData = response;
        await this.cache.setUserSession({
          requestedAt: response.requestedAt,
          userPageData: pageData,
        });
      }
    } else {
      // Logged-out page. Expire these after a short lifetime — enough to not
      // make pointless re-requests, but long enough to not be within a period
      // that the user could have logged in again.
      expireAfter(response, Date.now() + LOGGED_OUT_LIFETIME);
    }
  }

  async getPageData(options: RequestOptions = {}): Promise<PageData> {
    // We don't do retries here, as we can do them with greater control from the
    // UI level.
    const loadedResponse = this.loadedPageData;
    if (responseSatisfies(loadedResponse, options))
      return loadedResponse.pageData;

    for (let i = 1; ; ++i) {
      // shouldn't really be more than 2, only noStore constraint would prevent
      // the first iteration from loading.
      assert(i < 100, "unable to call loadPageData");

      // This only blocks briefly to fetch from the persistent store cache
      const existingLoadingResponsePromise = this.loadingPageData;
      const existingLoadingResponse = await existingLoadingResponsePromise;
      if (responseSatisfies(existingLoadingResponse, options)) {
        return existingLoadingResponse.pageData;
      }

      // Only a single ongoing request will start a new load, the others will follow.
      if (this.loadingPageData === existingLoadingResponsePromise) {
        this.loadingPageData = this.loadPageData(options);
      }
    }
  }
}

function expireAfter(response: PageDataResponse, expiredAfter: number): void {
  if (expiredAfter < (response.freshUntil ?? Number.POSITIVE_INFINITY)) {
    response.freshUntil = expiredAfter;
  }
}

function getFreshUntil(response: PageDataResponse): number {
  return response.freshUntil ?? 0;
}

function isFresh(response: PageDataResponse, minFresh: number = 0): boolean {
  if (!response.fromCache) return true;
  const freshMsRemaining = getFreshUntil(response) - Date.now();
  return freshMsRemaining > Math.max(0, minFresh);
}

function satisfiesMaxAge(
  response: PageDataResponse,
  maxAge: number = Number.MAX_SAFE_INTEGER,
): boolean {
  if (!response.fromCache) return true;
  const expiresAfter = Math.min(
    Number.MAX_SAFE_INTEGER,
    response.requestedAt + Math.max(0, maxAge),
  );
  return Date.now() <= expiresAfter;
}

function satisfiesNoCache(
  response: PageDataResponse,
  noCache: boolean,
): boolean {
  if (noCache) return response.fromCache || response.fromStore;
  return true;
}

function responseSatisfies(
  response: PageDataResponse | undefined,
  options?: RequestOptions,
): response is PageDataResponse {
  return (
    !!response &&
    isFresh(response, options?.minFresh) &&
    satisfiesMaxAge(response, options?.maxAge) &&
    satisfiesNoCache(response, options?.noCache ?? false)
  );
}
