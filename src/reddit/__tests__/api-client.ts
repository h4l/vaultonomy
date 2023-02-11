import { jest } from "@jest/globals";

import { assert } from "../../assert";
import { HTTPResponseError } from "../../errors/http";
import {
  createAddressOwnershipChallenge,
  getRedditAccountVaultAddress,
  registerAddressWithAccount,
} from "../api-client";
import { redditEIP712Challenge } from "./api-client.fixtures";

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
      `"https://meta-api.reddit.com/crypto/ethereum/challenges?request_timestamp=42"`
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
      })
    ).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchOptions] = fetch.mock.calls[0];
    const fetchHeaders = fetchOptions?.headers as Partial<
      Record<string, string>
    >;
    expect(fetchUrl).toEqual(
      "https://meta-api.reddit.com/crypto/ethereum/registrations?request_timestamp=42"
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

describe("getRedditAccountVaultAddress()", () => {
  const responseBody = () => ({
    contacts: {
      exampleUserId: [
        {
          active: true,
          address: "0x0000000000000000000000000000000000000000",
          provider: "ethereum",
          userId: "exampleUserId",
          username: "exampleusername",
        },
      ],
    },
  });

  test("handles successful request for account with an address", async () => {
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => responseBody(),
    } as Response);

    await expect(
      getRedditAccountVaultAddress({
        username: "exampleusername",
        authToken: "secret",
      })
    ).resolves.toEqual("0x0000000000000000000000000000000000000000");

    expect(fetch).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchOptions] = fetch.mock.calls[0];
    const fetchHeaders = fetchOptions?.headers as Partial<
      Record<string, string>
    >;
    expect(fetchUrl).toEqual(
      "https://meta-api.reddit.com/crypto-contacts?usernames=exampleusername"
    );
    expect(fetchHeaders?.authorization).toEqual("Bearer secret");
    expect(fetchHeaders?.["content-type"]).toEqual("application/json");
  });

  test("returns address for requested username if response contains multiple results", async () => {
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        contacts: {
          exampleUserId1: [
            {
              active: true,
              address: "0x0000000000000000000000000000000000000001",
              provider: "ethereum",
              userId: "exampleUserId1",
              username: "exampleusername1",
            },
          ],
          exampleUserId2: [
            {
              active: false,
              address: "0x0000000000000000000000000000000000000001",
              provider: "ethereum",
              userId: "exampleUserId2",
              username: "exampleusername2",
            },
            {
              active: true,
              address: "0x0000000000000000000000000000000000000002",
              provider: "ethereum",
              userId: "exampleUserId2",
              username: "exampleusername2",
            },
          ],
        },
      }),
    } as Response);

    await expect(
      getRedditAccountVaultAddress({
        username: "exampleusername2",
        authToken: "secret",
      })
    ).resolves.toEqual("0x0000000000000000000000000000000000000002");

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("handles successful request for account without an address", async () => {
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);

    await expect(
      getRedditAccountVaultAddress({
        username: "exampleusername",
        authToken: "secret",
      })
    ).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("handles unsuccessful response", async () => {
    const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "something is not right" }),
    } as Response);

    const [result] = await Promise.allSettled([
      getRedditAccountVaultAddress({
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
