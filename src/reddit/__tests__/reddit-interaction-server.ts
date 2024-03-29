import { describe, expect, jest, test } from "@jest/globals";
import { mock } from "jest-mock-extended";
import {
  JSONRPCClient,
  JSONRPCErrorException,
  JSONRPCServer,
} from "json-rpc-2.0";
import { getAddress } from "viem";

import { dateParseStrict } from "../../__tests__/testing.utils";
import { HTTPResponseError } from "../../errors/http";
import type { SessionManager } from "../SessionManager";
import {
  AccountVaultAddress,
  RedditEIP712Challenge,
  RedditUserVault,
} from "../api-client";
import {
  ErrorCode,
  RedditGetUserVaultParams,
} from "../reddit-interaction-spec";
import { RedditUserProfile } from "../types";
import { RedditEIP712Challenges } from "./api-client.fixtures";
import { anonUser, loggedInUser, userProfile } from "./page-data.fixtures";

jest.useFakeTimers();

type SessionManagerModule = typeof import("../SessionManager");
jest.unstable_mockModule(
  "./src/reddit/SessionManager",
  (): SessionManagerModule => ({
    createCachedSessionManager: jest.fn() as any,
    SessionManager: jest.fn() as any,
  }),
);

const originalApiclient = await import("../api-client");
type APIClientMod = typeof originalApiclient;
jest.unstable_mockModule<typeof originalApiclient>(
  "./src/reddit/api-client.ts",
  async () => {
    return {
      ...originalApiclient,
      createAddressOwnershipChallenge:
        jest.fn<APIClientMod["createAddressOwnershipChallenge"]>(),
      registerAddressWithAccount:
        jest.fn<APIClientMod["registerAddressWithAccount"]>(),
      getRedditUserVault: jest.fn<APIClientMod["getRedditUserVault"]>(),
      getRedditAccountVaultAddresses:
        jest.fn<APIClientMod["getRedditAccountVaultAddresses"]>(),
      getRedditUserProfile: jest.fn<APIClientMod["getRedditUserProfile"]>(),
    };
  },
);

type CrossOriginFrontendModule = typeof import("../../cross-origin/frontend");
jest.unstable_mockModule<CrossOriginFrontendModule>(
  "./src/cross-origin/frontend.ts",
  () => ({
    fetchCrossOrigin: jest.fn<CrossOriginFrontendModule["fetchCrossOrigin"]>(),
  }),
);

function mockResponse(status: number = 500): Response {
  return { status } satisfies Partial<Response> as Response;
}

const { createCachedSessionManager } = await import("../SessionManager");
const { createServerSession } = await import("../reddit-interaction-server");
const {
  createAddressOwnershipChallenge,
  registerAddressWithAccount,
  getRedditUserVault,
  getRedditAccountVaultAddresses,
  getRedditUserProfile,
} = await import("../api-client");

const { fetchCrossOrigin } = await import("../../cross-origin/frontend");

describe("createServerSession()", () => {
  let server: JSONRPCServer;
  let client: JSONRPCClient;
  const sessionManager = mock<SessionManager>();

  beforeEach(() => {
    // default API mock implementations
    jest.mocked(createCachedSessionManager).mockReturnValue(sessionManager);
    jest.mocked(sessionManager.getPageData).mockResolvedValue(loggedInUser());
    jest
      .mocked(createAddressOwnershipChallenge)
      .mockResolvedValueOnce(RedditEIP712Challenges().example);
    jest.mocked(registerAddressWithAccount).mockResolvedValue(undefined);
    jest.mocked(getRedditUserVault).mockRejectedValue("not mocked");
    jest.mocked(getRedditAccountVaultAddresses).mockResolvedValue([]);
    jest.mocked(getRedditUserProfile).mockRejectedValue("not mocked");

    jest.setSystemTime(new Date("2023-01-01T00:00:00Z"));
    server = createServerSession();
    client = new JSONRPCClient(async (payload) => {
      const resp = await server.receive(payload);
      if (resp !== null) client.receive(resp);
    });
  });

  describe("reddit_getUserProfile", () => {
    test.each([null, { session: null }, { userId: "t2_abc" }])(
      "responds with profile of logged-in user",
      async (params) => {
        const response = await client.request("reddit_getUserProfile", params);

        expect(RedditUserProfile.safeParse(response).success).toBeTruthy();
        expect(response).toEqual(loggedInUser().user);

        expect(sessionManager.getPageData).toBeCalledTimes(1);
      },
    );

    test("responds with error if logged-in user does not match userId param", async () => {
      const response = client.request("reddit_getUserProfile", {
        session: { userId: "t2_other" },
      });

      await expect(response).rejects.toEqual(
        new JSONRPCErrorException(
          "Active session is not for the expected userId",
          ErrorCode.WRONG_USER,
        ),
      );
    });

    test("responds with error if user is not logged in to reddit", async () => {
      jest.mocked(sessionManager.getPageData).mockResolvedValueOnce(anonUser());

      const resp = client.request("reddit_getUserProfile", null);
      await expect(resp).rejects.toEqual(
        new JSONRPCErrorException(
          "User is not logged in to the Reddit website",
          ErrorCode.USER_NOT_LOGGED_IN,
        ),
      );
    });

    test("responds with ErrorCode.NOT_FOUND if username request 404s", async () => {
      jest
        .mocked(getRedditUserProfile)
        .mockReset()
        .mockRejectedValue(
          new HTTPResponseError("Not Found", {
            response: mockResponse(404),
          }),
        );

      const resp = client.request("reddit_getUserProfile", {
        username: "missing",
      });
      await expect(resp).rejects.toEqual(
        new JSONRPCErrorException(
          "Reddit API responded with 404",
          ErrorCode.NOT_FOUND,
        ),
      );
    });

    describe("when a username param is provided", () => {
      test("responds with the profile of another user", async () => {
        jest.mocked(getRedditUserProfile).mockResolvedValueOnce(userProfile());

        const response = await client.request("reddit_getUserProfile", {
          session: { userId: "t2_abc" },
          username: "carbonatedcamel",
        });

        expect(RedditUserProfile.safeParse(response).success).toBeTruthy();
        expect(response).toEqual(userProfile());

        expect(sessionManager.getPageData).toBeCalledTimes(1);
        expect(getRedditUserProfile).toBeCalledTimes(1);
      });

      test("responds with an error the API call to get the profile fails", async () => {
        jest
          .mocked(getRedditUserProfile)
          .mockReset()
          .mockRejectedValue(
            new HTTPResponseError("getRedditUserProfile failed", {
              response: mockResponse(),
            }),
          );

        const response = client.request("reddit_getUserProfile", {
          session: { userId: "t2_abc" },
          username: "carbonatedcamel",
        });

        await expect(response).rejects.toEqual(
          new JSONRPCErrorException("getRedditUserProfile failed", 0),
        );
      });
    });
  });

  describe("reddit_createAddressOwnershipChallenge", () => {
    test("responds with challenge data", async () => {
      const response = await client.request(
        "reddit_createAddressOwnershipChallenge",
        { session: { userId: "t2_abc" }, address: "0x" + "0".repeat(40) },
      );

      expect(RedditEIP712Challenge.safeParse(response).success).toBeTruthy();
      expect(response).toEqual(RedditEIP712Challenges().example);
      expect(createAddressOwnershipChallenge).toBeCalledTimes(1);
    });

    test("responds with error if logged-in user does not match userId param", async () => {
      const response = client.request(
        "reddit_createAddressOwnershipChallenge",
        { session: { userId: "t2_other" }, address: "0x" + "0".repeat(40) },
      );

      await expect(response).rejects.toEqual(
        new JSONRPCErrorException(
          "Active session is not for the expected userId",
          ErrorCode.WRONG_USER,
        ),
      );
    });

    test("responds with error when API request fails", async () => {
      jest
        .mocked(createAddressOwnershipChallenge)
        .mockReset()
        .mockRejectedValue(
          new HTTPResponseError("createAddressOwnershipChallenge failed", {
            response: mockResponse(),
          }),
        );

      const resp = client.request("reddit_createAddressOwnershipChallenge", {
        session: { userId: "t2_abc" },
        address: "0x" + "0".repeat(40),
      });
      await expect(resp).rejects.toEqual(
        new JSONRPCErrorException("createAddressOwnershipChallenge failed", 0),
      );
    });
  });

  describe("reddit_registerAddressWithAccount", () => {
    const params = (userId: string = "t2_abc") => ({
      session: { userId },
      address: "0x" + "0".repeat(40),
      challengeSignature: "0x" + "0".repeat(130),
    });
    test("handles valid request", async () => {
      const resp = client.request(
        "reddit_registerAddressWithAccount",
        params(),
      );

      await expect(resp).resolves.toBeNull();
      expect(registerAddressWithAccount).toBeCalledTimes(1);
      expect(registerAddressWithAccount).toBeCalledWith({
        fetch: fetchCrossOrigin,
        authToken: "secret",
        address: "0x" + "0".repeat(40),
        challengeSignature: "0x" + "0".repeat(130),
      });
    });

    test("responds with error if logged-in user does not match userId param", async () => {
      const response = client.request(
        "reddit_registerAddressWithAccount",
        params("t2_other"),
      );

      await expect(response).rejects.toEqual(
        new JSONRPCErrorException(
          "Active session is not for the expected userId",
          ErrorCode.WRONG_USER,
        ),
      );
    });

    test("responds with error when API request fails", async () => {
      jest
        .mocked(registerAddressWithAccount)
        .mockReset()
        .mockRejectedValue(
          new HTTPResponseError("registerAddressWithAccount failed", {
            response: mockResponse(),
          }),
        );

      const resp = client.request(
        "reddit_registerAddressWithAccount",
        params(),
      );
      await expect(resp).rejects.toEqual(
        new JSONRPCErrorException("registerAddressWithAccount failed", 0),
      );
    });
  });

  describe("reddit_getUserVault", () => {
    const vault = (): RedditUserVault => ({
      address: "0x67F63690530782B716477733a085ce7A8310bc4C",
      userId: "exampleUserId",
      isActive: true,
    });

    test("handles valid request", async () => {
      jest.mocked(getRedditUserVault).mockResolvedValueOnce(vault());
      const resp = client.request("reddit_getUserVault", {
        query: { userId: "exampleUserId" },
      } satisfies RedditGetUserVaultParams);

      await expect(resp).resolves.toEqual(vault());
      expect(getRedditUserVault).toBeCalledTimes(1);
      expect(getRedditUserVault).toBeCalledWith({
        fetch: fetchCrossOrigin,
        userId: "exampleUserId",
        authToken: "secret",
      });
    });

    test("responds with error when API request fails", async () => {
      jest
        .mocked(getRedditUserVault)
        .mockReset()
        .mockRejectedValue(
          new HTTPResponseError("getRedditUserVault failed", {
            response: mockResponse(),
          }),
        );

      const resp = client.request("reddit_getUserVault", {
        query: { userId: "exampleUserId" },
      });
      await expect(resp).rejects.toEqual(
        new JSONRPCErrorException("getRedditUserVault failed", 0),
      );
    });
  });

  describe("reddit_getAccountVaultAddresses", () => {
    const addresses = (): Array<AccountVaultAddress> => [
      {
        address: "0x5318810BD26f9209c3d4ff22891F024a2b0A739a",
        createdAt: dateParseStrict("2023-02-04T11:12:36.000000+0000"),
        isActive: true,
      },
    ];

    test("handles valid request", async () => {
      jest
        .mocked(getRedditAccountVaultAddresses)
        .mockReset()
        .mockResolvedValue(addresses());

      const resp = client.request("reddit_getAccountVaultAddresses", {
        session: { userId: "t2_abc" },
      });

      await expect(resp).resolves.toEqual(addresses());
      expect(getRedditAccountVaultAddresses).toBeCalledTimes(1);
      expect(getRedditAccountVaultAddresses).toBeCalledWith({
        fetch: fetchCrossOrigin,
        authToken: "secret",
      });
    });

    test("responds with error if logged-in user does not match userId param", async () => {
      const response = client.request("reddit_getAccountVaultAddresses", {
        session: { userId: "t2_other" },
      });

      await expect(response).rejects.toEqual(
        new JSONRPCErrorException(
          "Active session is not for the expected userId",
          ErrorCode.WRONG_USER,
        ),
      );
    });

    test("responds with error when API request fails", async () => {
      jest
        .mocked(getRedditAccountVaultAddresses)
        .mockReset()
        .mockRejectedValue(
          new HTTPResponseError("getRedditAccountVaultAddresses failed", {
            response: mockResponse(),
          }),
        );

      const resp = client.request("reddit_getAccountVaultAddresses", {
        session: { userId: "t2_abc" },
      });
      await expect(resp).rejects.toEqual(
        new JSONRPCErrorException("getRedditAccountVaultAddresses failed", 0),
      );
    });
  });
});
