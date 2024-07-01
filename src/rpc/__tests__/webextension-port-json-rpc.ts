import { jest } from "@jest/globals";
import {
  JSONRPCClient,
  JSONRPCErrorException,
  JSONRPCServer,
  createJSONRPCRequest,
  createJSONRPCSuccessResponse,
} from "json-rpc-2.0";

import { MockPort } from "../../__tests__/webextension.mock";

import { sleep } from "../../__tests__/testing.utils";
import { retroactivePortDisconnection } from "../../webextensions/retroactivePortDisconnection";
import {
  bindPortToJSONRPCClient,
  bindPortToJSONRPCServer,
  createPortSendRequestFn,
} from "../webextension-port-json-rpc";

describe("server — bindPortToJSONRPCServer()", () => {
  let server: JSONRPCServer;
  let port: MockPort;
  beforeEach(() => {
    server = new JSONRPCServer({ errorListener: () => undefined });
    server.addMethod("echo", async (params: unknown) => {
      return { paramsReceived: params };
    });
    port = new MockPort();
  });

  test("server receives messages from Port and responds to Port", async () => {
    bindPortToJSONRPCServer({ port, server });

    port.receiveMessage(createJSONRPCRequest(1, "echo", "Hello"));
    await sleep();

    expect(port.postMessage).toHaveBeenCalledTimes(1);
    expect(port.postMessage).toHaveBeenCalledWith(
      createJSONRPCSuccessResponse(1, { paramsReceived: "Hello" }),
    );
  });

  test("server no longer receives messages after unbinding", async () => {
    const unbind = bindPortToJSONRPCServer({ port, server });
    jest.spyOn(server, "receive");

    port.receiveMessage(createJSONRPCRequest(1, "echo", "Hello"));
    await sleep();
    expect(server.receive).toHaveBeenCalledTimes(1);

    unbind();
    port.receiveMessage(createJSONRPCRequest(2, "echo", "Hello"));
    await sleep();
    expect(server.receive).toHaveBeenCalledTimes(1); // still only 1
  });
});

test("createPortSendRequestFn()", () => {
  const port = new MockPort();
  const sendFn = createPortSendRequestFn(port);
  const msg = createJSONRPCRequest(1, "hi");
  sendFn(msg);
  expect(port.postMessage).toHaveBeenCalledTimes(1);
  expect(port.postMessage).toHaveBeenCalledWith(msg);
});

describe("bindPortToJSONRPCClient()", () => {
  let client: JSONRPCClient;
  let port: MockPort;
  beforeEach(() => {
    port = new MockPort();
    retroactivePortDisconnection.register(port);
    client = new JSONRPCClient(createPortSendRequestFn(port));
  });

  test("client sends requests to and receives responses from Port", async () => {
    bindPortToJSONRPCClient({ port, client });

    const futureResponse = client.request("greet", "hi");
    await expect(
      Promise.race([futureResponse, sleep().then(() => "slept")]),
    ).resolves.toEqual("slept");

    expect(port.postMessage).toHaveBeenCalledTimes(1);
    expect(port.postMessage).toHaveBeenCalledWith(
      createJSONRPCRequest(1, "greet", "hi"),
    );

    port.receiveMessage(createJSONRPCSuccessResponse(1, "hi to you too"));
    await expect(futureResponse).resolves.toEqual("hi to you too");
  });

  test("client no longer receives responses after unbinding", async () => {
    const unbind = bindPortToJSONRPCClient({ port, client });
    jest.spyOn(client, "receive");

    const response1 = client.request("greet", "hi");
    port.receiveMessage(createJSONRPCSuccessResponse(1, "hi to you too"));
    await expect(response1).resolves.toEqual("hi to you too");
    expect(client.receive).toHaveBeenCalledTimes(1);

    const response2 = client.request("greet", "hi");
    unbind();
    // pending responses are cancelled after unbinding
    await expect(response2).rejects.toThrow(JSONRPCErrorException),
      await expect(response2).rejects.toThrow(
        /JSONRPCClient was unbound from Port/,
      );
    port.receiveMessage(createJSONRPCSuccessResponse(1, "hi to you too"));
    await sleep();
    expect(client.receive).toHaveBeenCalledTimes(1); // still only 1
  });

  test("client cancels pending responses when Port disconnects", async () => {
    bindPortToJSONRPCClient({ port, client });
    jest.spyOn(client, "receive");

    const response1 = client.request("greet", "hi");
    await sleep();
    expect(port.postMessage).toHaveBeenCalledTimes(1);

    port.receiveDisconnect();

    await expect(response1).rejects.toEqual(
      new JSONRPCErrorException("Port is disconnected", 0),
    );
  });
});
