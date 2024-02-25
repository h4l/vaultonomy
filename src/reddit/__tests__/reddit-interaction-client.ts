import { expect, jest } from "@jest/globals";
import {
  createJSONRPCErrorResponse,
  createJSONRPCSuccessResponse,
} from "json-rpc-2.0";

import { MockPort } from "../../__tests__/webextension.mock";

import { sleep } from "../../__tests__/testing.utils";
import { assert } from "../../assert";
import { AccountVaultAddress, RedditUserVault } from "../api-client";
import {
  RedditProvider,
  RedditProviderError,
} from "../reddit-interaction-client";
import {
  ErrorCode,
  RedditGetUserProfileParams,
  RedditGetUserVaultParams,
} from "../reddit-interaction-spec";
import { redditEIP712Challenge } from "./api-client.fixtures";
import { loggedInUser } from "./page-data.fixtures";

describe("RedditProvider()", () => {
  describe("from(Port)", () => {
    test.each`
      propagateDisconnect
      ${true}
      ${false}
    `(
      'disconnects from Port when "disconnectSelf" fires with propagateDisconnect: $propagateDisconnect',
      async ({ propagateDisconnect }: { propagateDisconnect: boolean }) => {
        const rpDisconnected = jest.fn();
        const port = MockPort.createAndRegisterRetroactiveDisconnection();
        const reddit = RedditProvider.from(port, { propagateDisconnect });
        reddit.emitter.on("disconnected", rpDisconnected);

        reddit.emitter.emit("disconnectSelf");
        await sleep();

        expect(port.onMessage.removeListener).toHaveBeenCalled();
        expect(jest.mocked(port.disconnect).mock.calls.length).toEqual(
          propagateDisconnect ? 1 : 0,
        );
        // As with Port, initiating a disconnect does not notify ourself.
        expect(rpDisconnected).not.toHaveBeenCalled();
      },
    );

    test("provider fires disconnected when its Port's other end disconnects", async () => {
      const rpDisconnected = jest.fn();
      const port = MockPort.createAndRegisterRetroactiveDisconnection();
      const reddit = RedditProvider.from(port);
      reddit.emitter.on("disconnected", rpDisconnected);

      port.receiveDisconnect();
      await sleep();

      expect(rpDisconnected).toHaveBeenCalled();
      expect(port.onMessage.removeListener).toHaveBeenCalled();
    });
  });

  describe("RPC methods", () => {
    let port: MockPort;
    let reddit: RedditProvider;
    beforeEach(() => {
      port = MockPort.createAndRegisterRetroactiveDisconnection();
      reddit = RedditProvider.from(port);
    });

    describe("getUserProfile()", () => {
      test("can accept no arguments", async () => {
        const resp = reddit.getUserProfile();
        port.receiveMessage(
          createJSONRPCSuccessResponse(1, loggedInUser().user),
        );
        await expect(resp).resolves.toEqual(loggedInUser().user);
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
        createJSONRPCSuccessResponse(1, redditEIP712Challenge()),
      );
      await expect(resp).resolves.toEqual(redditEIP712Challenge());
    });

    test("registerAddressWithAccount()", async () => {
      const resp = reddit.registerAddressWithAccount({
        session: { userId: "t2_abc" },
        address: `0x${"0".repeat(40)}`,
        challengeSignature: `0x${"0".repeat(130)}`,
      });
      port.receiveMessage(createJSONRPCSuccessResponse(1, null));
      await expect(resp).resolves.toBeNull();
    });

    describe("getUserVault()", () => {
      const vault = (): RedditUserVault => ({
        address: "0x67F63690530782B716477733a085ce7A8310bc4C",
        userId: "exampleUserId",
        username: "exampleUserName",
        isActive: true,
      });

      test.each<RedditGetUserVaultParams["query"]>([
        { type: "username", value: "example" },
        {
          type: "address",
          value: "0x67F63690530782B716477733a085ce7A8310bc4C",
        },
      ])("handles vault response", async (query) => {
        const resp = reddit.getUserVault({
          session: { userId: "t2_abc" },
          query,
        });
        port.receiveMessage(createJSONRPCSuccessResponse(1, vault()));
        await expect(resp).resolves.toEqual(vault());
      });

      test.each<RedditGetUserVaultParams["query"]>([
        { type: "username", value: "example" },
      ])("handles no-vault response", async (query) => {
        const resp = reddit.getUserVault({
          session: { userId: "t2_abc" },
          query,
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
          address: "0x5318810BD26f9209c3d4ff22891F024a2b0A739a",
          createdAt: 1704694321215,
          isActive: true,
          modifiedAt: 1704694321215,
        },
      ];
      port.receiveMessage(createJSONRPCSuccessResponse(1, addresses()));
      await expect(resp).resolves.toEqual(addresses());
    });
  });
});
