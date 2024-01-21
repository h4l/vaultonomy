import { jest } from "@jest/globals";
import { mock } from "jest-mock-extended";

import { assert } from "../../assert";
import { HTTPResponseError } from "../../errors/http";
import { log } from "../../logging";
import type { UserPageDataCache } from "../UserPageDataCache";
import { UserPageData } from "../page-data";
import { anonUser, loggedInUser } from "./page-data.fixtures";

type PageDataModule = typeof import("../page-data");
jest.unstable_mockModule(
  "./src/reddit/page-data",
  (): Partial<PageDataModule> => ({
    UserPageData: jest.fn() as any,
    fetchPageData: jest.fn<PageDataModule["fetchPageData"]>(),
  }),
);

type UserPageDataCacheModule = typeof import("../UserPageDataCache");
jest.unstable_mockModule(
  "./src/reddit/UserPageDataCache",
  (): Partial<UserPageDataCacheModule> => ({
    createPrivateUserPageDataCache: jest.fn() as any,
  }),
);

const { fetchPageData } = await import("../page-data");
const { createPrivateUserPageDataCache } = await import("../UserPageDataCache");
const { SessionManager, createCachedSessionManager } = await import(
  "../SessionManager"
);

const DAY = 1000 * 60 * 60 * 24;
const SECOND = 1000;

describe("createCachedSessionManager()", () => {
  test("uses createPrivateUserPageDataCache()", () => {
    const cache: UserPageDataCache = mock<UserPageDataCache>();
    jest.mocked(createPrivateUserPageDataCache).mockReturnValueOnce(cache);

    const sm = createCachedSessionManager();

    expect(sm).toBeInstanceOf(SessionManager);
    expect((sm as any).cache).toBe(cache);
  });
});

describe("SessionManager", () => {
  let cachedUser: UserPageData | undefined;
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
    jest.mocked(fetchPageData).mockResolvedValueOnce(user1);

    const sm = new SessionManager(cache);

    const pendingSessions = [...new Array(5)].map(() => sm.getPageData());
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
    jest.advanceTimersByTime(SECOND);
    await expect(sm.getPageData()).resolves.toEqual(noUser);
    // The second request is served from the in-memory cache
    expect(fetchPageData).toHaveBeenCalledTimes(1);

    // in-memory cache expires after a few seconds
    jest.advanceTimersByTime(5 * SECOND);

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
    jest.advanceTimersByTime(DAY / 2);

    // Start a new environment with no in-memory cache
    const sm2 = new SessionManager(cache);
    await expect(sm2.getPageData()).resolves.toEqual(user1);
    jest.advanceTimersByTime(DAY / 4);
    await expect(sm2.getPageData()).resolves.toEqual(user1);

    // The second request is served from the in-persistent cache
    // The third from the in-memory cache
    expect(cache.getUserSession).toHaveBeenCalledTimes(2);
    expect(fetchPageData).toHaveBeenCalledTimes(1);

    // Once user1 expires, fetchPageData is called again
    jest.advanceTimersByTime(DAY / 4);

    const user2Expires = Date.now() + DAY;
    assert(user1Expires < user2Expires);
    const user2 = loggedInUser({ authExpires: new Date(user2Expires) });
    jest.mocked(fetchPageData).mockResolvedValueOnce(user2);

    await expect(sm2.getPageData()).resolves.toEqual(user2);
    expect(fetchPageData).toHaveBeenCalledTimes(2);
  });

  // test("concurrent requests that fail are handled by a single fetchPageData()", async () => {

  test("Recovers from fetchPageData() errors by retrying", async () => {
    jest.spyOn(log, "error").mockImplementation(() => {});

    const user1Expires = Date.now() + DAY;
    const user1 = loggedInUser({ authExpires: new Date(user1Expires) });

    // getPageData makes 3 attempts max when fetchPageData requests fail
    jest
      .mocked(fetchPageData)
      .mockRejectedValueOnce(new HTTPResponseError("fail1", {} as any))
      .mockRejectedValueOnce(new HTTPResponseError("fail2X", {} as any))
      .mockResolvedValueOnce(user1);

    const sm1 = new SessionManager(cache);
    const pendingPageData = sm1.getPageData();

    // First attempt happens immediately and fails
    await jest.advanceTimersByTimeAsync(10);
    expect(fetchPageData).toHaveBeenCalledTimes(1);

    // Second attempt happens 100ms after first fails. It also fails.
    await jest.advanceTimersByTimeAsync(100);
    expect(fetchPageData).toHaveBeenCalledTimes(2);

    // Third attempt happens 1000ms after second fails. It succeeds.
    await jest.advanceTimersByTimeAsync(1000);
    expect(fetchPageData).toHaveBeenCalledTimes(3);

    await expect(pendingPageData).resolves.toEqual(user1);
    expect(log.error).toBeCalledTimes(2);
  });

  test("Throws last fetchPageData() error after 3 attempts", async () => {
    jest.spyOn(log, "error").mockImplementation(() => {});

    const user1 = loggedInUser({ authExpires: new Date(Date.now() + DAY) });
    jest
      .mocked(fetchPageData)
      .mockRejectedValueOnce(new HTTPResponseError("fail1", {} as any))
      .mockRejectedValueOnce(new HTTPResponseError("fail2", {} as any))
      .mockRejectedValueOnce(new HTTPResponseError("fail3", {} as any))
      .mockResolvedValueOnce(user1);

    const sm1 = new SessionManager(cache);
    const pendingPageData = sm1.getPageData();
    pendingPageData.catch(() => {}); // prevent the error being unhandled before we expect it

    await jest.advanceTimersByTimeAsync(200);
    // Requests that come in while retrying use the ongoing retrying response
    const concurrentRequest = sm1.getPageData();
    concurrentRequest.catch(() => {});

    await jest.advanceTimersByTimeAsync(SECOND);
    expect(fetchPageData).toHaveBeenCalledTimes(3);

    await expect(pendingPageData).rejects.toThrowError(HTTPResponseError);
    await expect(pendingPageData).rejects.toThrowError("fail3");
    await expect(concurrentRequest).rejects.toThrowError(HTTPResponseError);
    await expect(concurrentRequest).rejects.toThrowError("fail3");

    expect(log.error).toBeCalledTimes(3);

    // The error response isn't cached after the retry attempts fail
    await expect(sm1.getPageData()).resolves.toEqual(user1);
  });
});
