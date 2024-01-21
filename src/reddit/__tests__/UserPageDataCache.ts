import { jest } from "@jest/globals";

import { MockStorage } from "../../__tests__/webextension.mock";

import { assert } from "../../assert";
import { loggedInUser } from "./page-data.fixtures";

type PrivateCache = typeof import("../private-cache");

jest.unstable_mockModule(
  "./src/reddit/private-cache/index",
  (): Partial<PrivateCache> => ({
    safeGetPrivateCache: jest.fn<PrivateCache["safeGetPrivateCache"]>(),
  }),
);

const { safeGetPrivateCache } = await import("../private-cache");
const { createPrivateUserPageDataCache } = await import("../UserPageDataCache");

const storage = new MockStorage();
const SESSION_KEY = "reddit.session";

beforeEach(() => {
  storage.mockClear();
});

describe("createPrivateUserPageDataCache", () => {
  test("uses cache from safeGetPrivateCache()", async () => {
    const session = loggedInUser();
    jest.spyOn(storage, "remove");
    jest
      .mocked(safeGetPrivateCache)
      .mockImplementation(async ({ onCreated }) => {
        assert(onCreated);
        await onCreated({
          cache: storage as any,
          storage: storage as any,
        });
        return storage;
      });

    const cache = createPrivateUserPageDataCache();

    await expect(cache.getUserSession()).resolves.toBeUndefined();

    await cache.setUserSession(session);
    await expect(cache.getUserSession()).resolves.toEqual(session);

    expect(safeGetPrivateCache).toHaveBeenCalledTimes(1);

    // session was written to storage returned by getPrivateCache()
    await expect(storage.get(SESSION_KEY)).resolves.toStrictEqual({
      [SESSION_KEY]: JSON.parse(JSON.stringify(session)),
    });

    // we called clear inside mock safeGetPrivateCache()
    expect(storage.remove).toHaveBeenCalledTimes(1);
    expect(storage.remove).toHaveBeenLastCalledWith(SESSION_KEY);
  });

  test("transparently does not cache when safeGetPrivateCache() returns undefined", async () => {
    const session = loggedInUser();
    const cache = createPrivateUserPageDataCache();

    await cache.setUserSession(session);
    await expect(cache.getUserSession()).resolves.toBeUndefined();
    expect(safeGetPrivateCache).toHaveBeenCalledTimes(1);
  });
});
