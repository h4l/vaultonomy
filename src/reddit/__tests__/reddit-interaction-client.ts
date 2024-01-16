import { expect, jest } from "@jest/globals";
import { createJSONRPCSuccessResponse } from "json-rpc-2.0";

import { MockPort } from "../../__tests__/webextension.mock";

import { sleep } from "../../__tests__/testing.utils";
import { AccountVaultAddress } from "../api-client";
import { RedditProvider } from "../reddit-interaction-client";
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

    test("getUserProfile()", async () => {
      const resp = reddit.getUserProfile();
      port.receiveMessage(createJSONRPCSuccessResponse(1, loggedInUser().user));
      await expect(resp).resolves.toEqual(loggedInUser().user);
    });

    test("createAddressOwnershipChallenge()", async () => {
      const resp = reddit.createAddressOwnershipChallenge({
        address: `0x${"0".repeat(40)}`,
      });
      port.receiveMessage(
        createJSONRPCSuccessResponse(1, redditEIP712Challenge()),
      );
      await expect(resp).resolves.toEqual(redditEIP712Challenge());
    });

    test("registerAddressWithAccount()", async () => {
      const resp = reddit.registerAddressWithAccount({
        address: `0x${"0".repeat(40)}`,
        challengeSignature: `0x${"0".repeat(130)}`,
      });
      port.receiveMessage(createJSONRPCSuccessResponse(1, null));
      await expect(resp).resolves.toBeNull();
    });

    test("getAccountVaultAddress()", async () => {
      const resp = reddit.getUserVaultAddress({ username: "example" });
      port.receiveMessage(
        createJSONRPCSuccessResponse(1, `0x${"0".repeat(40)}`),
      );
      await expect(resp).resolves.toEqual(`0x${"0".repeat(40)}`);
    });

    test("getAccountVaultAddresses()", async () => {
      const resp = reddit.getAccountVaultAddresses();
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
