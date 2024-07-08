import { jest } from "@jest/globals";
import type { Mocked } from "jest-mock";
import { mock } from "jest-mock-extended";

import { sleep } from "../../__tests__/testing.utils";
import { assert } from "../../assert";
import { HTTPResponseError } from "../../errors/http";
import { log } from "../../logging";
import type {
  StoredUserPageData,
  UserPageDataCache,
} from "../UserPageDataCache";
import { anonUser, loggedInUser } from "./page-data.fixtures";

type PageDataModule = typeof import("../page-data");
jest.unstable_mockModule(
  "./src/reddit/page-data",
  (): Partial<PageDataModule> => ({
    UserPageData: mock<PageDataModule["UserPageData"]>(),
    fetchPageData: jest.fn<PageDataModule["fetchPageData"]>(),
  }),
);

type UserPageDataCacheModule = typeof import("../UserPageDataCache");
jest.unstable_mockModule(
  "./src/reddit/UserPageDataCache",
  (): Partial<Mocked<UserPageDataCacheModule>> => ({
    createPrivateUserPageDataCache: jest.fn(),
  }),
);

const { fetchPageData } = await import("../page-data");
const { createPrivateUserPageDataCache } = await import("../UserPageDataCache");
const { SessionManager, createCachedSessionManager } = await import(
  "../SessionManager"
);

const SECOND = 1000;
const HOUR = 1000 * 60 * 60;
const DAY = HOUR * 24;

describe("createCachedSessionManager()", () => {
  test("uses createPrivateUserPageDataCache()", () => {
    const cache: UserPageDataCache = mock<UserPageDataCache>();
    jest.mocked(createPrivateUserPageDataCache).mockReturnValueOnce(cache);

    const sm = createCachedSessionManager();

    expect(sm).toBeInstanceOf(SessionManager);
    expect(sm["cache"]).toBe(cache);
  });
});

describe("SessionManager", () => {
  let cachedUser: StoredUserPageData | undefined;
  const cache: UserPageDataCache = mock<UserPageDataCache>();

  beforeEach(() => {
    cachedUser = undefined;
    jest
      .mocked(cache.getUserSession)
      .mockImplementation(async () => cachedUser);
    jest.mocked(cache.setUserSession).mockImplementation(async (s) => {
      cachedUser = s;
    });
    jest.mocked(cache.clear).mockImplementation(async () => {
      cachedUser = undefined;
    });

    jest.mocked(fetchPageData).mockRejectedValue(new Error("NOT MOCKED"));
    jest.useFakeTimers();
  });

  test("concurrent requests are grouped and served by a single fetchPageData() call", async () => {
    const user1Expires = Date.now() + DAY;
    const user1 = loggedInUser({ authExpires: new Date(user1Expires) });

    jest.mocked(fetchPageData).mockImplementationOnce(async () => {
      await sleep();
      return user1;
    });

    const sm = new SessionManager(cache);
    const pendingSessions = [...new Array(5)].map(() => sm.getPageData());

    await jest.advanceTimersToNextTimerAsync();
    const sessions = await Promise.all(pendingSessions);

    for (const session of sessions) {
      expect(session).toBe(sessions[0]);
      expect(session).toStrictEqual(user1);
    }
    expect(fetchPageData).toHaveBeenCalledTimes(1);
  });

  test("in-memory cache handles requests returning logged-in sessions before they expire", async () => {
    const user1Expires = Date.now() + DAY;
    const user1 = loggedInUser({ authExpires: new Date(user1Expires) });
    jest.mocked(fetchPageData).mockResolvedValueOnce(user1);

    const sm = new SessionManager(cache);
    await expect(sm.getPageData()).resolves.toEqual(user1);
    jest.advanceTimersByTime(DAY / 2);
    await expect(sm.getPageData()).resolves.toEqual(user1);
    // The second request is served from the in-memory cache
    expect(fetchPageData).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(DAY / 2);

    const user2Expires = Date.now() + DAY;
    assert(user1Expires < user2Expires);
    const user2 = loggedInUser({ authExpires: new Date(user2Expires) });
    jest.mocked(fetchPageData).mockResolvedValueOnce(user2);

    await expect(sm.getPageData()).resolves.toEqual(user2);
    expect(fetchPageData).toHaveBeenCalledTimes(2);
  });

  test("logged-out sessions are cached only for a short period", async () => {
    const noUser = anonUser();
    jest.mocked(fetchPageData).mockResolvedValue(noUser);

    const sm = new SessionManager(cache);
    await expect(sm.getPageData()).resolves.toEqual(noUser);
    jest.advanceTimersByTime(SECOND / 2);
    await expect(sm.getPageData()).resolves.toEqual(noUser);
    // The second request is served from the in-memory cache
    expect(fetchPageData).toHaveBeenCalledTimes(1);

    // logged-out responses are cached for ~1 second
    jest.advanceTimersByTime(SECOND);

    await expect(sm.getPageData()).resolves.toEqual(noUser);
    expect(fetchPageData).toHaveBeenCalledTimes(2);
  });

  test("persistent cache handles requests returning logged-in users before they expire", async () => {
    const user1Expires = Date.now() + DAY;
    const user1 = loggedInUser({ authExpires: new Date(user1Expires) });
    jest.mocked(fetchPageData).mockResolvedValueOnce(user1);

    const sm1 = new SessionManager(cache);
    await expect(sm1.getPageData()).resolves.toEqual(user1);
    expect(cache.getUserSession).toHaveBeenCalledTimes(1);
    expect(fetchPageData).toHaveBeenCalledTimes(1);

    // cache is now populated with user1 response
    await jest.advanceTimersByTimeAsync(DAY / 2);

    // Start a new environment with no in-memory cache but the same persistent cache
    const sm2 = new SessionManager(cache);
    await expect(sm2.getPageData()).resolves.toEqual(user1);
    await jest.advanceTimersByTimeAsync(DAY / 4);
    await expect(sm2.getPageData()).resolves.toEqual(user1);

    // The second request is served from the in-persistent cache
    // The third from the in-memory cache
    expect(cache.getUserSession).toHaveBeenCalledTimes(2);
    expect(fetchPageData).toHaveBeenCalledTimes(1);

    // Once user1 expires, fetchPageData is called again
    await jest.advanceTimersByTimeAsync(DAY / 4);

    const user2Expires = Date.now() + DAY;
    assert(user1Expires < user2Expires);
    const user2 = loggedInUser({ authExpires: new Date(user2Expires) });
    jest.mocked(fetchPageData).mockResolvedValueOnce(user2);

    await expect(sm2.getPageData()).resolves.toEqual(user2);
    expect(fetchPageData).toHaveBeenCalledTimes(2);
  });

  test("Throws errors from fetchPageData without retrying", async () => {
    jest.spyOn(log, "error").mockImplementation(() => {});

    const user1Expires = Date.now() + DAY;
    const user1 = loggedInUser({ authExpires: new Date(user1Expires) });

    jest
      .mocked(fetchPageData)
      .mockImplementationOnce(async () => {
        sleep();
        throw new HTTPResponseError("fail1", { response: {} as Response });
      })
      .mockResolvedValueOnce(user1);

    const sm1 = new SessionManager(cache);

    // First attempt fails (concurrent requests use the same request & error)
    const [req1, req2] = [sm1.getPageData(), sm1.getPageData()];
    await expect(req1).rejects.toThrow("fail1");
    await expect(req2).rejects.toThrow("fail1");
    expect(fetchPageData).toHaveBeenCalledTimes(1);

    // Second attempt succeeds
    await jest.advanceTimersByTimeAsync(10);
    await expect(sm1.getPageData()).resolves.toEqual(user1);
  });

  test("minFresh", async () => {
    const user1 = loggedInUser({ authExpires: new Date(Date.now() + DAY) });
    const user2 = loggedInUser({ authExpires: new Date(Date.now() + DAY * 2) });

    jest
      .mocked(fetchPageData)
      .mockResolvedValueOnce(user1)
      .mockResolvedValueOnce(user2);

    const sm = new SessionManager(cache);
    await expect(sm.getPageData()).resolves.toEqual(user1);

    // 1h 1s left
    await jest.advanceTimersByTimeAsync(HOUR * 23 - SECOND);
    await expect(sm.getPageData({ minFresh: HOUR })).resolves.toEqual(user1);

    // Now 1s less than 1h left
    await jest.advanceTimersByTimeAsync(SECOND * 2);
    await expect(sm.getPageData({ minFresh: HOUR })).resolves.toEqual(user2);
  });

  test("maxAge", async () => {
    const user1 = loggedInUser({ authExpires: new Date(Date.now() + DAY) });
    const user2 = loggedInUser({ authExpires: new Date(Date.now() + DAY * 2) });

    jest
      .mocked(fetchPageData)
      .mockResolvedValueOnce(user1)
      .mockResolvedValueOnce(user2);

    const sm = new SessionManager(cache);
    await expect(sm.getPageData()).resolves.toEqual(user1);

    await jest.advanceTimersByTimeAsync(SECOND / 2);
    await expect(sm.getPageData({ maxAge: SECOND })).resolves.toEqual(user1);

    await jest.advanceTimersByTimeAsync(SECOND);
    await expect(sm.getPageData({ maxAge: SECOND })).resolves.toEqual(user2);
  });

  test("noCache", async () => {
    const user1 = loggedInUser({ authExpires: new Date(Date.now() + DAY) });
    const user2 = loggedInUser({ authExpires: new Date(Date.now() + DAY * 2) });

    jest
      .mocked(fetchPageData)
      .mockResolvedValueOnce(user1)
      .mockResolvedValueOnce(user2);

    const sm = new SessionManager(cache);
    await expect(sm.getPageData({})).resolves.toEqual(user1);

    await jest.advanceTimersByTimeAsync(SECOND / 2);
    await expect(sm.getPageData({ noCache: true })).resolves.toEqual(user2);

    // noCache doesn't stop us caching the response, it only stops a cached
    // response being used to serve the noCache request. So a subsequent request
    // without noCache can be served by the cached response.
    await jest.advanceTimersByTimeAsync(SECOND);
    await expect(sm.getPageData({})).resolves.toEqual(user2);
  });

  test("Errors are not cached", async () => {
    jest
      .mocked(fetchPageData)
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"));

    const sm = new SessionManager(cache);
    await expect(sm.getPageData()).rejects.toThrow("fail1");

    await jest.advanceTimersByTimeAsync(SECOND / 2);
    await expect(sm.getPageData({ maxAge: SECOND })).rejects.toThrow("fail2");
  });
});
