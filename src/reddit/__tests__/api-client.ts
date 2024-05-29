import { jest } from "@jest/globals";

import { dateParseStrict } from "../../__tests__/testing.utils";
import { assert } from "../../assert";
import { HTTPResponseError } from "../../errors/http";
import {
  AccountVaultAddress,
  createAddressOwnershipChallenge,
  getRedditAccountVaultAddresses,
  getRedditUserProfile,
  getRedditUserVault,
  registerAddressWithAccount,
} from "../api-client";
import { APIError } from "../gql-fed-api";
import { SuspendedRedditUserProfile } from "../types";
import {
  GetAllVaultsQueryResponses,
  GetUserVaultQueryResponses,
  GetVaultRegistrationChallengeResponses,
  RedditEIP712Challenges,
  RegisterVaultAddressResponses,
  oauthRedditUserAboutResponse,
  oauthRedditUserAboutResponseSuspended,
} from "./api-client.fixtures";
import { userProfile } from "./page-data.fixtures";

describe("createAddressOwnershipChallenge()", () => {
  test("handles successful request", async () => {
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => GetVaultRegistrationChallengeResponses().example,
    } as Response);

    const resp = await createAddressOwnershipChallenge({
      address: "0xbc10830dF34D3bf10d934f008A191F3a85B4DD51",
      authToken: "secret",
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(resp).toEqual(RedditEIP712Challenges().example);
    const [fetchUrl, fetchOptions] = fetch.mock.calls[0];
    const fetchHeaders = fetchOptions?.headers as Partial<
      Record<string, string>
    >;
    expect(fetchUrl).toEqual("https://gql-fed.reddit.com/");
    expect(JSON.parse(String(fetchOptions?.body)).variables).toEqual({
      address: "0xbc10830df34d3bf10d934f008a191f3a85b4dd51",
      provider: "ethereum",
    });
    expect(fetchOptions?.method).toEqual("POST");
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
      status: 200,
      json: async () => RegisterVaultAddressResponses().example,
    } as Response);

    await expect(
      registerAddressWithAccount({
        address: "0xbc10830dF34D3bf10d934f008A191F3a85B4DD51",
        challengeSignature:
          "0xAa000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000fF",
        authToken: "secret",
      }),
    ).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchOptions] = fetch.mock.calls[0];
    const fetchHeaders = fetchOptions?.headers as Partial<
      Record<string, string>
    >;
    expect(fetchUrl).toEqual("https://gql-fed.reddit.com/");
    expect(JSON.parse(String(fetchOptions?.body))?.variables?.input).toEqual({
      address: "0xbc10830df34d3bf10d934f008a191f3a85b4dd51",
      provider: "ethereum",
      signature:
        "0xaa000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000ff",
    });
    expect(fetchHeaders?.authorization).toEqual("Bearer secret");
    expect(fetchHeaders?.["content-type"]).toEqual("application/json");
  });

  test("handles request with successful HTTP response but error in body", async () => {
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => RegisterVaultAddressResponses().speculativeError,
    } as Response);

    const result = registerAddressWithAccount({
      address: "0xbc10830dF34D3bf10d934f008A191F3a85B4DD51",
      challengeSignature:
        "0xAa000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000fF",
      authToken: "secret",
    });
    await expect(result).rejects.toThrow(APIError);
    await expect(result).rejects.toThrow(
      "API request to register address with account received successful response with error in response body: oops",
    );
  });

  test("handles request with successful HTTP response but GQL error in body", async () => {
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => RegisterVaultAddressResponses().error,
    } as Response);

    const result = registerAddressWithAccount({
      address: "0xbc10830dF34D3bf10d934f008A191F3a85B4DD51",
      challengeSignature:
        "0xAa000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000fF",
      authToken: "secret",
    });
    await expect(result).rejects.toThrow(APIError);
    await expect(result).rejects.toThrow(
      "API request to register address with account did not execute successfully",
    );
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
  test.each([
    { response: GetUserVaultQueryResponses().noVault, expected: undefined },
    {
      response: GetUserVaultQueryResponses().hasVault,
      expected: {
        address: "0xbc10830dF34D3bf10d934f008A191F3a85B4DD51",
        isActive: true,
        userId: "t2_4h7kj7wob",
      },
    },
  ] as const)("handles successful request", async ({ response, expected }) => {
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => response,
    } as Response);

    await expect(
      getRedditUserVault({
        userId: "t2_4h7kj7wob",
        authToken: "secret",
      }),
    ).resolves.toEqual(expected);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchOptions] = fetch.mock.calls[0];
    const fetchHeaders = fetchOptions?.headers as Partial<
      Record<string, string>
    >;
    expect(fetchUrl).toEqual("https://gql-fed.reddit.com/");
    expect(fetchOptions?.method).toEqual("POST");
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
      getRedditUserVault({
        userId: "t2_foo",
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
  test.each([
    {
      response: GetAllVaultsQueryResponses().none,
      expected: [],
    },
    {
      response: GetAllVaultsQueryResponses().single,
      expected: [
        {
          address: "0xA5C590Ab4f9d1E75a77a41e00f50113B0806F280",
          createdAt: dateParseStrict("2024-02-18T07:32:19.000000+0000"),
          isActive: true,
        },
      ],
    },
    {
      response: GetAllVaultsQueryResponses().multiple,
      expected: [
        {
          address: "0x2bBA0433D7D798981d08EC4aC93d3bd301F3b4Bd",
          createdAt: dateParseStrict("2023-02-04T11:12:36.000000+0000"),
          isActive: false,
        },
        {
          address: "0x5d70d1DdA55C6EC028de8de42395Be1Cf43F0815",
          createdAt: dateParseStrict("2023-02-10T11:43:22.000000+0000"),
          isActive: false,
        },
        {
          address: "0xA5C590Ab4f9d1E75a77a41e00f50113B0806F280",
          createdAt: dateParseStrict("2024-02-18T07:32:19.000000+0000"),
          isActive: true,
        },
      ],
    },
  ] as const)("handles successful request", async ({ response, expected }) => {
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => response,
    } as Response);

    await expect(
      getRedditAccountVaultAddresses({
        authToken: "secret",
      }),
    ).resolves.toEqual<ReadonlyArray<AccountVaultAddress>>(expected);
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

  test.each([undefined, null, "", "lol"])(
    "handles user profile without a valid avatar: %s",
    // The API returns an empty string for people without a current avatar (e.g.
    // an old uploaded image avatar).
    async (avatarValue: unknown) => {
      const noAvatarResponse = () => {
        const data = oauthRedditUserAboutResponse();
        (data.data as any).snoovatar_img = avatarValue;
        if (avatarValue === undefined) {
          delete (data.data as any).snoovatar_img;
        }
        return data;
      };
      const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => noAvatarResponse(),
      } as Response);

      await expect(
        getRedditUserProfile({
          username: "carbonatedcamel",
          authToken: "secret",
        }),
      ).resolves.toEqual({ ...userProfile(), accountIconFullBodyURL: null });
    },
  );

  test("handles successful request for suspended user profile", async () => {
    const expectedProfile: SuspendedRedditUserProfile = {
      username: "MetaMask",
      isSuspended: true,
    };
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => oauthRedditUserAboutResponseSuspended(),
    } as Response);

    await expect(
      getRedditUserProfile({
        username: "MetaMask",
        authToken: "secret",
      }),
    ).resolves.toEqual(expectedProfile);
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
