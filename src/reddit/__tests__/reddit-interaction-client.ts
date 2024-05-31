import { expect, jest } from "@jest/globals";
import {
  createJSONRPCErrorResponse,
  createJSONRPCSuccessResponse,
} from "json-rpc-2.0";

import { MockPort } from "../../__tests__/webextension.mock";

import { dateParseStrict } from "../../__tests__/testing.utils";
import { assert } from "../../assert";
import { Connector } from "../../rpc/connections";
import { AccountVaultAddress, RedditUserVault } from "../api-client";
import {
  RedditProvider,
  RedditProviderError,
} from "../reddit-interaction-client";
import {
  ErrorCode,
  RedditGetUserProfileParams,
} from "../reddit-interaction-spec";
import { RedditEIP712Challenges } from "./api-client.fixtures";
import { loggedInUser } from "./page-data.fixtures";

describe("RedditProvider()", () => {
  describe("from(Port)", () => {
    test("disconnect() disconnects from Port", async () => {
      jest.useFakeTimers();
      const rpDisconnected = jest.fn();
      const [portConnector, port] = MockPort.createMockConnector();
      const reddit = RedditProvider.from(portConnector);
      reddit.emitter.on("disconnected", rpDisconnected);

      // Port is not connected until an RPC call is made
      reddit.getUserProfile().catch(() => {});
      await jest.runAllTimersAsync();

      reddit.disconnect();
      await jest.runAllTimersAsync();

      expect(port.onMessage.removeListener).toHaveBeenCalled();
      expect(port.disconnect).toHaveBeenCalled();
      expect(rpDisconnected).toHaveBeenCalled();
    });

    test("provider fires disconnected when its Port's other end disconnects", async () => {
      jest.useFakeTimers();
      const rpDisconnected = jest.fn();
      const [portConnector, port] = MockPort.createMockConnector();
      const reddit = RedditProvider.from(portConnector);
      reddit.emitter.on("disconnected", rpDisconnected);

      // Port is not connected until an RPC call is made
      reddit.getUserProfile().catch(() => {});
      await jest.runAllTimersAsync();

      port.receiveDisconnect();
      await jest.runAllTimersAsync();

      expect(rpDisconnected).toHaveBeenCalled();
      expect(port.onMessage.removeListener).toHaveBeenCalled();
    });
  });

  describe("RPC methods", () => {
    let portConnector: Connector<chrome.runtime.Port>;
    let port: MockPort;
    let reddit: RedditProvider;
    let messages: any[] = [];
    beforeEach(() => {
      [portConnector, port] = MockPort.createMockConnector();
      reddit = RedditProvider.from(portConnector);

      messages = [];
      jest.mocked(port.postMessage).mockImplementation((message) => {
        messages.push(message);
      });
    });

    describe("getUserProfile()", () => {
      test("can accept no arguments", async () => {
        const resp = reddit.getUserProfile();
        port.receiveMessage(
          createJSONRPCSuccessResponse(1, loggedInUser().user),
        );
        await expect(resp).resolves.toEqual(loggedInUser().user);
        expect(messages.length).toBe(1);
        expect(messages[0].params).toBeNull();
      });
      test.each<RedditGetUserProfileParams>([
        { session: { userId: "t2_abc" }, username: "h4l" },
        { session: { userId: "t2_abc" } },
        { session: { userId: "t2_abc" }, username: null },
        { username: null },
        { username: "h4l" },
        {},
      ])("can session and username arguments", async (params) => {
        const resp = reddit.getUserProfile(params);
        port.receiveMessage(
          createJSONRPCSuccessResponse(1, loggedInUser().user),
        );
        await expect(resp).resolves.toEqual(loggedInUser().user);
        expect(messages.length).toBe(1);
        expect(messages[0].params).toEqual(params);
      });
      test("handles NOT_FOUND error", async () => {
        const resp = reddit.getUserProfile();
        port.receiveMessage(
          createJSONRPCErrorResponse(1, ErrorCode.NOT_FOUND, "I tried 🤷"),
        );
        const [resolved] = await Promise.allSettled([resp]);
        assert(resolved.status === "rejected");
        assert(resolved.reason instanceof RedditProviderError);
        expect(resolved.reason.type).toEqual(ErrorCode.NOT_FOUND);
        expect(resolved.reason.message).toEqual("I tried 🤷");
      });
    });

    test("createAddressOwnershipChallenge()", async () => {
      const resp = reddit.createAddressOwnershipChallenge({
        session: { userId: "t2_abc" },
        address: `0x${"0".repeat(40)}`,
      });
      port.receiveMessage(
        createJSONRPCSuccessResponse(1, RedditEIP712Challenges().example),
      );
      await expect(resp).resolves.toEqual(RedditEIP712Challenges().example);
    });

    describe("registerAddressWithAccount()", () => {
      test("returns null for successful request", async () => {
        const resp = reddit.registerAddressWithAccount({
          session: { userId: "t2_abc" },
          address: `0x${"0".repeat(40)}`,
          challengeSignature: `0x${"0".repeat(130)}`,
        });
        port.receiveMessage(createJSONRPCSuccessResponse(1, null));
        await expect(resp).resolves.toBeNull();
      });

      // Reddit's API returns error responses when an address cannot be
      // registered (e.g. due to already being registered elsewhere), so we must
      // handle this case.
      test("handles REDDIT_API_UNSUCCESSFUL error", async () => {
        const resp = reddit.getUserProfile();
        port.receiveMessage(
          createJSONRPCErrorResponse(
            1,
            ErrorCode.REDDIT_API_UNSUCCESSFUL,
            "Example",
          ),
        );
        const [resolved] = await Promise.allSettled([resp]);
        assert(resolved.status === "rejected");
        assert(resolved.reason instanceof RedditProviderError);
        expect(resolved.reason.type).toEqual(ErrorCode.REDDIT_API_UNSUCCESSFUL);
        expect(resolved.reason.message).toEqual("Example");
      });
    });

    describe("getUserVault()", () => {
      const vault = (): RedditUserVault => ({
        address: "0x67F63690530782B716477733a085ce7A8310bc4C",
        userId: "exampleUserId",
        isActive: true,
      });

      test("handles vault response", async () => {
        const resp = reddit.getUserVault({
          query: { userId: "exampleUserId" },
        });
        port.receiveMessage(createJSONRPCSuccessResponse(1, vault()));
        await expect(resp).resolves.toEqual(vault());
      });

      test("handles no-vault response", async () => {
        const resp = reddit.getUserVault({
          query: { userId: "exampleUserId" },
        });
        port.receiveMessage(createJSONRPCSuccessResponse(1, null));
        await expect(resp).resolves.toBeNull();
      });
    });

    test("getAccountVaultAddresses()", async () => {
      const resp = reddit.getAccountVaultAddresses({
        session: { userId: "t2_abc" },
      });
      const addresses = (): Array<AccountVaultAddress> => [
        {
          address: "0xA5C590Ab4f9d1E75a77a41e00f50113B0806F280",
          isActive: true,
          createdAt: dateParseStrict("2024-02-18T07:32:19.000000+0000"),
        },
      ];
      port.receiveMessage(createJSONRPCSuccessResponse(1, addresses()));
      await expect(resp).resolves.toEqual(addresses());
    });
  });
});
