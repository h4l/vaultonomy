import { describe, expect, jest, test } from "@jest/globals";
import {
  JSONRPCClient,
  JSONRPCErrorException,
  JSONRPCServer,
} from "json-rpc-2.0";

import { HTTPResponseError } from "../../errors/http";
import { RedditEIP712Challenge } from "../api-client";
import { ErrorCode, RedditUserProfile } from "../reddit-interaction-spec";
import { redditEIP712Challenge } from "./api-client.fixtures";
import { anonUser, loggedInUser } from "./page-data.fixtures";

jest.useFakeTimers();
jest.unstable_mockModule("./src/reddit/page-data.ts", () => ({
  fetchPageData: jest.fn(),
}));
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
      getRedditAccountVaultAddress:
        jest.fn<APIClientMod["getRedditAccountVaultAddress"]>(),
    };
  },
);

const { createServerSession } = await import("../reddit-interaction-server");
const { fetchPageData } = await import("../page-data");
const {
  createAddressOwnershipChallenge,
  registerAddressWithAccount,
  getRedditAccountVaultAddress,
} = await import("../api-client");

describe("createServerSession()", () => {
  let server: JSONRPCServer;
  let client: JSONRPCClient;

  beforeEach(() => {
    jest.setSystemTime(new Date("2023-01-01T00:00:00Z"));
    server = createServerSession();
    client = new JSONRPCClient(async (payload) => {
      const resp = await server.receive(payload);
      if (resp !== null) client.receive(resp);
    });

    // default API mock implementations
    jest.mocked(fetchPageData).mockResolvedValueOnce(loggedInUser());
    jest
      .mocked(createAddressOwnershipChallenge)
      .mockResolvedValueOnce(redditEIP712Challenge());
    jest.mocked(registerAddressWithAccount).mockResolvedValue(undefined);
    jest
      .mocked(getRedditAccountVaultAddress)
      .mockResolvedValueOnce("0x" + "0".repeat(40));
  });

  describe("reddit_getUserProfile", () => {
    test("responds with profile of logged-in user", async () => {
      const response = await client.request("reddit_getUserProfile", null);

      expect(RedditUserProfile.safeParse(response).success).toBeTruthy();
      expect(response).toEqual(loggedInUser().user);
      expect(fetchPageData).toBeCalledTimes(1);
    });

    test("responds with error if user is not logged in to reddit", async () => {
      jest.mocked(fetchPageData).mockReset().mockResolvedValueOnce(anonUser());

      const resp = client.request("reddit_getUserProfile", null);
      await expect(resp).rejects.toEqual(
        new JSONRPCErrorException(
          "User is not logged in to the Reddit website",
          ErrorCode.USER_NOT_LOGGED_IN,
        ),
      );
    });

    test.each`
      timeOfRequest             | desc
      ${"2023-01-01T23:55:00Z"} | ${"within expiry slop period"}
      ${"2023-01-02T12:00:00Z"} | ${"after the token expiry date"}
    `("request fails when the time is $desc", async ({ timeOfRequest }) => {
      // 5 minutes from actual expiry
      jest.setSystemTime(new Date(timeOfRequest));
      jest.mocked(fetchPageData).mockResolvedValueOnce(loggedInUser());

      const resp = client.request("reddit_getUserProfile", null);
      await expect(resp).rejects.toEqual(
        new JSONRPCErrorException(
          "User auth credentials have expired",
          ErrorCode.SESSION_EXPIRED,
        ),
      );
    });
  });

  describe("reddit_createAddressOwnershipChallenge", () => {
    test("responds with challenge data", async () => {
      const response = await client.request(
        "reddit_createAddressOwnershipChallenge",
        { address: "0x" + "0".repeat(40) },
      );

      expect(RedditEIP712Challenge.safeParse(response).success).toBeTruthy();
      expect(response).toEqual(redditEIP712Challenge());
      expect(createAddressOwnershipChallenge).toBeCalledTimes(1);
    });

    test("responds with error when API request fails", async () => {
      jest
        .mocked(createAddressOwnershipChallenge)
        .mockReset()
        .mockRejectedValue(
          new HTTPResponseError("createAddressOwnershipChallenge failed", {
            response: undefined as unknown as Response,
          }),
        );

      const resp = client.request("reddit_createAddressOwnershipChallenge", {
        address: "0x" + "0".repeat(40),
      });
      await expect(resp).rejects.toEqual(
        new JSONRPCErrorException("createAddressOwnershipChallenge failed", 0),
      );
    });
  });

  describe("reddit_registerAddressWithAccount", () => {
    const params = () => ({
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
    });

    test("responds with error when API request fails", async () => {
      jest
        .mocked(registerAddressWithAccount)
        .mockReset()
        .mockRejectedValue(
          new HTTPResponseError("registerAddressWithAccount failed", {
            response: undefined as unknown as Response,
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

  describe("reddit_getAccountVaultAddress", () => {
    test("handles valid request", async () => {
      const resp = client.request("reddit_getAccountVaultAddress", null);

      await expect(resp).resolves.toEqual("0x" + "0".repeat(40));
      expect(getRedditAccountVaultAddress).toBeCalledTimes(1);
      expect(getRedditAccountVaultAddress).toBeCalledWith({
        username: "exampleuser",
        authToken: "secret",
      });
    });

    test("responds with error when API request fails", async () => {
      jest
        .mocked(getRedditAccountVaultAddress)
        .mockReset()
        .mockRejectedValue(
          new HTTPResponseError("getRedditAccountVaultAddress failed", {
            response: undefined as unknown as Response,
          }),
        );

      const resp = client.request("reddit_getAccountVaultAddress", null);
      await expect(resp).rejects.toEqual(
        new JSONRPCErrorException("getRedditAccountVaultAddress failed", 0),
      );
    });
  });
});
