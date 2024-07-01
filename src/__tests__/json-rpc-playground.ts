import { jest } from "@jest/globals";
import { waitFor } from "@testing-library/dom";
import {
  JSONRPCClient,
  JSONRPCServer,
  JSONRPCServerAndClient,
} from "json-rpc-2.0";

describe("JSON RPC", () => {
  test("client request server", async () => {
    const server = new JSONRPCServer();
    const client = new JSONRPCClient(async (payload) => {
      const resp = await server.receive(payload);
      if (resp !== null) client.receive(resp);
    });

    server.addMethod("add", ({ a, b }: { a: number; b: number }) => ({
      answer: a + b,
    }));

    await expect(client.request("add", { a: 1, b: 3 })).resolves.toEqual({
      answer: 4,
    });
  });

  test("client notify server", async () => {
    const server = new JSONRPCServer();
    const client = new JSONRPCClient(async (payload) => {
      const resp = await server.receive(payload);
      if (resp !== null) client.receive(resp);
    });

    const action = jest.fn();
    server.addMethod("someEvent", ({ a, b }: { a: number; b: number }) => {
      action(a, b);
    });
    client.notify("someEvent", { a: 1, b: 3 });
    expect(action).toHaveBeenCalledWith(1, 3);
  });

  test("bi-directional server and client", async () => {
    const fooSide = new JSONRPCServerAndClient(
      new JSONRPCServer(),
      new JSONRPCClient(async (payload) => {
        const resp = await barSide.server.receive(payload);
        if (resp) fooSide.client.receive(resp);
      }),
    );

    const barSide = new JSONRPCServerAndClient(
      new JSONRPCServer(),
      new JSONRPCClient(async (payload) => {
        const resp = await fooSide.server.receive(payload);
        if (resp) barSide.client.receive(resp);
      }),
    );

    let subscription: NodeJS.Timeout;
    fooSide.server.addMethod(
      "subscribe",
      ({ a, b }: { a: number; b: number }) => {
        let value = a;
        subscription = setInterval(() => {
          fooSide.client.notify("someEvent", { detail: (value += b) });
        }, 0);
      },
    );

    let unsubscribed = false;
    fooSide.server.addMethod("unsubscribe", () => {
      clearInterval(subscription);
      unsubscribed = true;
    });

    const event = jest.fn();
    barSide.addMethod("someEvent", async ({ detail }: { detail: number }) => {
      event(detail);
      if (detail > 3) {
        await barSide.request("unsubscribe", {});
      }
    });

    await barSide.client.request("subscribe", { a: 0, b: 2 });
    await waitFor(() => {
      expect(unsubscribed).toBeTruthy();
    });
    expect(event).toHaveBeenNthCalledWith(1, 2);
    expect(event).toHaveBeenNthCalledWith(2, 4);
  });

  test("server error handling", async () => {
    const errorListener = jest.fn();
    const server = new JSONRPCServer({ errorListener });

    const client = new JSONRPCClient(async (payload) => {
      const resp = await server.receive(payload);
      if (resp !== null) client.receive(resp);
    });

    const error = new Error("add method failed");
    server.addMethod("add", async () => {
      throw error;
    });

    let e: unknown;
    try {
      await client.request("add", { a: 1, b: 3 });
      throw new Error("expected request to fail");
    } catch (e_) {
      e = e_;
    }
    // The server caught and re-transmitted the error -- it's not the same obj
    expect(e).not.toBe(error);
    // But it retains the same message
    expect(e).toEqual(error);
    expect(errorListener).toHaveBeenCalled();
  });
});
