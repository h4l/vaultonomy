import { jest } from "@jest/globals";

import { assert } from "../../assert";
import { HTTPResponseError } from "../../errors/http";
import {
  AccountVaultAddress,
  GetRedditUserVaultOptions,
  RedditUserVault,
  createAddressOwnershipChallenge,
  getRedditAccountVaultAddresses,
  getRedditUserProfile,
  getRedditUserVault,
  registerAddressWithAccount,
} from "../api-client";
import {
  MetaApiMeAddressResponses,
  oauthRedditUserAboutResponse,
  redditEIP712Challenge,
} from "./api-client.fixtures";
import { userProfile } from "./page-data.fixtures";

const exampleChallenge = redditEIP712Challenge;

describe("createAddressOwnershipChallenge()", () => {
  test("handles successful request", async () => {
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ payload: exampleChallenge() }),
    } as Response);

    const resp = await createAddressOwnershipChallenge({
      address: "0x0000000000000000000000000000000000000000",
      timestamp: 42,
      authToken: "secret",
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(resp).toEqual(exampleChallenge());
    const [fetchUrl, fetchOptions] = fetch.mock.calls[0];
    const fetchHeaders = fetchOptions?.headers as Partial<
      Record<string, string>
    >;
    expect(fetchUrl).toMatchInlineSnapshot(
      `"https://meta-api.reddit.com/crypto/ethereum/challenges?request_timestamp=42"`,
    );
    expect(fetchHeaders?.authorization).toEqual("Bearer secret");
    expect(fetchHeaders?.["content-type"]).toEqual("application/json");
  });

  test("handles unsuccessful request", async () => {
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "something is not right" }),
    } as Response);

    const [result] = await Promise.allSettled([
      createAddressOwnershipChallenge({
        address: "0x0000000000000000000000000000000000000000",
        timestamp: 42,
        authToken: "secret",
      }),
    ]);

    expect(fetch).toHaveBeenCalledTimes(1);
    assert(result.status === "rejected");
    assert(result.reason instanceof HTTPResponseError);
    expect(result.reason.response.status).toEqual(500);
  });
});

describe("registerAddressWithAccount()", () => {
  test("handles successful request", async () => {
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => ({ payload: exampleChallenge() }),
    } as Response);

    await expect(
      registerAddressWithAccount({
        address: "0x0000000000000000000000000000000000000000",
        challengeSignature:
          "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
        timestamp: 42,
        authToken: "secret",
      }),
    ).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchOptions] = fetch.mock.calls[0];
    const fetchHeaders = fetchOptions?.headers as Partial<
      Record<string, string>
    >;
    expect(fetchUrl).toEqual(
      "https://meta-api.reddit.com/crypto/ethereum/registrations?request_timestamp=42",
    );
    expect(fetchHeaders?.authorization).toEqual("Bearer secret");
    expect(fetchHeaders?.["content-type"]).toEqual("application/json");
  });

  test("handles unsuccessful response", async () => {
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "something is not right" }),
    } as Response);

    const [result] = await Promise.allSettled([
      registerAddressWithAccount({
        address: "0x0000000000000000000000000000000000000000",
        challengeSignature:
          "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
        timestamp: 42,
        authToken: "secret",
      }),
    ]);

    expect(fetch).toHaveBeenCalledTimes(1);
    assert(result.status === "rejected");
    assert(result.reason instanceof HTTPResponseError);
    expect(result.reason.response.status).toEqual(500);
  });
});

describe("getRedditUserVault()", () => {
  type Query = GetRedditUserVaultOptions["query"];
  const expectedResponseBody = () => ({
    contacts: {
      exampleUserId: [
        {
          active: true,
          address: "0x67F63690530782B716477733a085ce7A8310bc4C",
          provider: "ethereum",
          userId: "exampleUserId",
          username: "exampleUserName",
        },
      ],
    },
  });

  test.each<Query>([
    { type: "username", value: "exampleusername" },
    { type: "username", value: "EXAMPLEUSERNAME" },
    { type: "address", value: "0x67f63690530782b716477733a085ce7a8310bc4c" },
    { type: "address", value: "0x67F63690530782B716477733a085ce7A8310bc4C" },
  ])(
    "handles successful request for account with an address",
    async (query) => {
      const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => expectedResponseBody(),
      } as Response);
      const params: GetRedditUserVaultOptions = {
        query,
        authToken: "secret",
      };

      const expected: RedditUserVault = {
        address: "0x67F63690530782B716477733a085ce7A8310bc4C",
        userId: "exampleUserId",
        username: "exampleUserName",
        isActive: true,
      };
      await expect(getRedditUserVault(params)).resolves.toEqual(expected);

      expect(fetch).toHaveBeenCalledTimes(1);
      const [fetchUrl, fetchOptions] = fetch.mock.calls[0];
      const fetchHeaders = fetchOptions?.headers as Partial<
        Record<string, string>
      >;
      if (query.type === "username") {
        expect(fetchUrl).toEqual(
          "https://meta-api.reddit.com/crypto-contacts?usernames=exampleusername",
        );
      } else {
        expect(fetchUrl).toEqual(
          "https://meta-api.reddit.com/crypto-contacts?addresses=0x67F63690530782B716477733a085ce7A8310bc4C",
        );
      }
      expect(fetchHeaders?.authorization).toEqual("Bearer secret");
      expect(fetchHeaders?.["content-type"]).toEqual("application/json");
    },
  );

  test.each<{ query: Query; expected: "A" | "B" | "C" }>([
    {
      query: {
        type: "address",
        value: "0x0000000000000000000000000000000000000004",
      },
      expected: "A",
    },
    { query: { type: "username", value: "exampleusername2" }, expected: "B" },
    { query: { type: "username", value: "exampleusername3" }, expected: "C" },
  ])(
    "returns address for requested username if response contains edge case results",
    async ({ query, expected }) => {
      const expectedValues: Record<"A" | "B" | "C", RedditUserVault> = {
        A: {
          address: "0x0000000000000000000000000000000000000004",
          userId: "exampleUserId2",
          username: "exampleUserName2",
          isActive: false,
        },
        B: {
          address: "0x0000000000000000000000000000000000000005",
          userId: "exampleUserId2",
          username: "exampleUserName2",
          isActive: true,
        },
        C: {
          address: "0x0000000000000000000000000000000000000006",
          userId: "exampleUserId3",
          username: "exampleusername3",
          isActive: false,
        },
      };
      const expectedValue = expectedValues[expected];
      assert(expectedValue);

      jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          contacts: {
            exampleUserId1: [
              // This user has an address matching the other user but on a
              // different provider. (Possible in theory with contract wallets
              // not associated with a private key.)
              {
                active: true,
                address: "0x0000000000000000000000000000000000000004",
                provider: "randochain",
                userId: "exampleUserId1",
                username: "exampleusername1",
              },
              {
                active: true,
                address: "0x0000000000000000000000000000000000000001",
                provider: "ethereum",
                userId: "exampleUserId1",
                username: "exampleusername1",
              },
            ],
            exampleUserId2: [
              // We ignore non-ethereum provider vaults and prefer active over
              // inactive. However direct queries for inactive addresses return
              // the inactive vault. (In reality a query for an inactive vault
              // address does not also return the active vault in the same
              // response.)
              {
                active: false,
                address: "0x0000000000000000000000000000000000000002",
                provider: "ethereum",
                userId: "exampleUserId2",
                username: "exampleUserName2",
              },
              {
                active: true,
                address: "0x0000000000000000000000000000000000000003",
                provider: "randochain",
                userId: "exampleUserId2",
                username: "exampleUserName2",
              },
              {
                active: false,
                address: "0x0000000000000000000000000000000000000004",
                provider: "ethereum",
                userId: "exampleUserId2",
                username: "exampleUserName2",
              },
              {
                active: true,
                address: "0x0000000000000000000000000000000000000005",
                provider: "ethereum",
                userId: "exampleUserId2",
                username: "exampleUserName2",
              },
            ],
            exampleUserId3: [
              // User with only an inactive vault.
              {
                active: false,
                address: "0x0000000000000000000000000000000000000006",
                provider: "ethereum",
                userId: "exampleUserId3",
                username: "exampleusername3",
              },
            ],
          },
        }),
      } as Response);

      const resp = getRedditUserVault({
        query,
        authToken: "secret",
      } as GetRedditUserVaultOptions);

      await expect(resp).resolves.toEqual(expectedValues[expected]);
    },
  );

  test("handles unsuccessful response", async () => {
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "something is not right" }),
    } as Response);

    const [result] = await Promise.allSettled([
      getRedditUserVault({
        query: { type: "username", value: "exampleusername" },
        authToken: "secret",
      }),
    ]);

    expect(fetch).toHaveBeenCalledTimes(1);
    assert(result.status === "rejected");
    assert(result.reason instanceof HTTPResponseError);
    expect(result.reason.response.status).toEqual(500);
  });
});

describe("getRedditAccountVaultAddresses()", () => {
  test.each(MetaApiMeAddressResponses.empty())(
    "handles successful request for account with no vault history",
    async (response) => {
      jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => response,
      } as Response);

      await expect(
        getRedditAccountVaultAddresses({
          authToken: "secret",
        }),
      ).resolves.toEqual([]);
    },
  );

  test("handles successful request for account with one vault", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => MetaApiMeAddressResponses.single(),
    } as Response);

    await expect(
      getRedditAccountVaultAddresses({
        authToken: "secret",
      }),
    ).resolves.toEqual<Array<AccountVaultAddress>>([
      {
        address: "0x5318810BD26f9209c3d4ff22891F024a2b0A739a",
        createdAt: 1704694321215,
        isActive: true,
        modifiedAt: 1704694321215,
      },
    ]);
  });

  test("handles successful request for account with multiple vaults", async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => MetaApiMeAddressResponses.multi(),
    } as Response);

    await expect(
      getRedditAccountVaultAddresses({
        authToken: "secret",
      }),
    ).resolves.toEqual<Array<AccountVaultAddress>>([
      {
        address: "0x2bBA0433D7D798981d08EC4aC93d3bd301F3b4Bd",
        createdAt: 1675509156828,
        modifiedAt: null,
        isActive: false,
      },
      {
        address: "0x5d70d1DdA55C6EC028de8de42395Be1Cf43F0815",
        createdAt: 1676029402882,
        modifiedAt: null,
        isActive: true,
      },
    ]);
  });
});

describe("getRedditUserProfile()", () => {
  test("handles successful request for user profile", async () => {
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => oauthRedditUserAboutResponse(),
    } as Response);

    await expect(
      getRedditUserProfile({
        username: "carbonatedcamel",
        authToken: "secret",
      }),
    ).resolves.toEqual(userProfile());

    expect(fetch).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchOptions] = fetch.mock.calls[0];
    const fetchHeaders = fetchOptions?.headers as Partial<
      Record<string, string>
    >;
    expect(fetchUrl).toEqual(
      "https://oauth.reddit.com/user/carbonatedcamel/about.json",
    );
    expect(fetchHeaders?.authorization).toEqual("Bearer secret");
    expect(fetchHeaders?.["content-type"]).toEqual("application/json");
  });

  test("handles unsuccessful response", async () => {
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "something is not right" }),
    } as Response);

    const [result] = await Promise.allSettled([
      getRedditUserProfile({
        username: "exampleusername",
        authToken: "secret",
      }),
    ]);

    expect(fetch).toHaveBeenCalledTimes(1);
    assert(result.status === "rejected");
    assert(result.reason instanceof HTTPResponseError);
    expect(result.reason.response.status).toEqual(500);
  });
});
