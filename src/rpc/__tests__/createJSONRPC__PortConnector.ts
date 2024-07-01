import { jest } from "@jest/globals";
import { JSONRPCServer } from "json-rpc-2.0";

import { MockPort } from "../../__tests__/webextension.mock";

import { assert } from "../../assert";
import { createRawPortConnector } from "../../webextensions/createRawPortConnector";
import { AsyncConnector, Connector } from "../connections";
import {
  createJSONRPCClientPortConnector,
  createJSONRPCClientPortConnectorAsync,
  createJSONRPCServerAndClientPortConnector,
} from "../webextension-port-json-rpc";

const name = "json-rpc-port-connector-test-port";

describe("createJSONRPCClientPortConnector", () => {
  const mockPortConnector = jest.fn<Connector<chrome.runtime.Port>>(
    (onDisconnect) => {
      return createRawPortConnector(() => new MockPort({ name }))(onDisconnect);
    },
  );

  function getMockPort(): MockPort {
    if (jest.mocked(mockPortConnector).mock.results.length === 0)
      throw new Error("mockPortConnector has not been called");

    const result = mockPortConnector.mock.results.at(-1);
    if (result?.type !== "return")
      throw new Error("mockPortConnector did not return on last call");

    const [port, _] = result.value;
    assert(port instanceof MockPort);
    assert(port.name === name);
    return port;
  }

  test("creates client bound to Port", async () => {
    const connector = createJSONRPCClientPortConnector({
      portConnector: mockPortConnector,
    });

    const onDisconnect = jest.fn();
    const [client, disconnectClient] = connector(onDisconnect);

    const port = getMockPort();

    // Client is connected to port
    const req = client.request("example", null);
    port.receiveMessage({ jsonrpc: "2.0", result: "pong", id: 1 });
    await expect(req).resolves.toEqual("pong");

    // disconnectClient also disconnects the port
    disconnectClient();

    expect(onDisconnect).toHaveBeenCalled();
    expect(port.isDisconnected).toBeTruthy();
  });

  test("client disconnects from Port when Port is disconnected by other end", async () => {
    const connector = createJSONRPCClientPortConnector({
      portConnector: mockPortConnector,
    });

    const onDisconnect = jest.fn();
    const [client, _disconnectClient] = connector(onDisconnect);

    const port = getMockPort();

    // Client is connected to port
    const req = client.request("example", null);
    port.receiveMessage({ jsonrpc: "2.0", result: "pong", id: 1 });
    await expect(req).resolves.toEqual("pong");

    // the client disconnects when the Port is disconnected by the other end
    const req2 = client.request("example", null);
    port.receiveDisconnect();

    await expect(req2).rejects.toThrow(
      /Port is disconnected|JSONRPCClient was unbound from Port/,
    );
    expect(onDisconnect).toHaveBeenCalled();
    expect(port.isDisconnected).toBeTruthy();
  });
});

describe("createJSONRPCClientPortConnectorAsync", () => {
  const mockPortConnector = jest.fn<AsyncConnector<chrome.runtime.Port>>(
    async (onDisconnect) => {
      return createRawPortConnector(() => new MockPort({ name }))(onDisconnect);
    },
  );

  async function getMockPort(): Promise<MockPort> {
    if (jest.mocked(mockPortConnector).mock.results.length === 0)
      throw new Error("mockPortConnector has not been called");

    const result = mockPortConnector.mock.results.at(-1);
    if (result?.type !== "return")
      throw new Error("mockPortConnector did not return on last call");

    const [port, _] = await result.value;
    assert(port instanceof MockPort);
    assert(port.name === name);
    return port;
  }

  test("creates client bound to Port", async () => {
    const connector = createJSONRPCClientPortConnectorAsync({
      portConnector: mockPortConnector,
    });

    const onDisconnect = jest.fn();
    const [client, disconnectClient] = await connector(onDisconnect);

    const port = await getMockPort();

    // Client is connected to port
    const req = client.request("example", null);
    port.receiveMessage({ jsonrpc: "2.0", result: "pong", id: 1 });
    await expect(req).resolves.toEqual("pong");

    // disconnectClient also disconnects the port
    disconnectClient();

    expect(onDisconnect).toHaveBeenCalled();
    expect(port.isDisconnected).toBeTruthy();
  });

  test("client disconnects from Port when Port is disconnected by other end", async () => {
    const connector = createJSONRPCClientPortConnectorAsync({
      portConnector: mockPortConnector,
    });

    const onDisconnect = jest.fn();
    const [client, _disconnectClient] = await connector(onDisconnect);

    const port = await getMockPort();

    // Client is connected to port
    const req = client.request("example", null);
    port.receiveMessage({ jsonrpc: "2.0", result: "pong", id: 1 });
    await expect(req).resolves.toEqual("pong");

    // the client disconnects when the Port is disconnected by the other end
    const req2 = client.request("example", null);
    port.receiveDisconnect();

    await expect(req2).rejects.toThrow(
      /Port is disconnected|JSONRPCClient was unbound from Port/,
    );
    expect(onDisconnect).toHaveBeenCalled();
    expect(port.isDisconnected).toBeTruthy();
  });
});

describe("createJSONRPCServerAndClientPortConnector", () => {
  const mockPortConnector = jest.fn<Connector<chrome.runtime.Port>>(
    (onDisconnect) => {
      return createRawPortConnector(() => new MockPort({ name }))(onDisconnect);
    },
  );

  function getMockPort(): MockPort {
    if (jest.mocked(mockPortConnector).mock.results.length === 0)
      throw new Error("mockPortConnector has not been called");

    const result = mockPortConnector.mock.results.at(-1);
    if (result?.type !== "return")
      throw new Error("mockPortConnector did not return on last call");

    const [port, _] = result.value;
    assert(port instanceof MockPort);
    assert(port.name === name);
    return port;
  }

  function createServer() {
    const server = new JSONRPCServer();
    server.addMethod("strlen", async (params) => {
      assert(typeof params === "string");
      return params.length;
    });
    return server;
  }

  test("creates serverAndClient bound to Port", async () => {
    jest.useFakeTimers();

    const connector = createJSONRPCServerAndClientPortConnector({
      portConnector: mockPortConnector,
      createServer,
    });

    const onDisconnect = jest.fn();
    const [serverAndClient, disconnectServerAndClient] =
      connector(onDisconnect);

    const port = getMockPort();

    // serverAndClient is connected to port — it can send requests
    const req = serverAndClient.request("example", null);
    port.receiveMessage({ jsonrpc: "2.0", result: "pong", id: 1 });
    await expect(req).resolves.toEqual("pong");
    // It can handle requests
    port.receiveMessage({
      jsonrpc: "2.0",
      method: "strlen",
      params: "foo",
      id: 42,
    });
    await jest.advanceTimersToNextTimerAsync();

    expect(port.postMessage).toHaveBeenCalledWith({
      jsonrpc: "2.0",
      result: 3,
      id: 42,
    });

    // disconnectServerAndClient also disconnects the port
    disconnectServerAndClient();

    expect(onDisconnect).toHaveBeenCalled();
    expect(port.isDisconnected).toBeTruthy();
  });

  test("serverAndClient disconnects from Port when Port is disconnected by other end", async () => {
    const connector = createJSONRPCServerAndClientPortConnector({
      portConnector: mockPortConnector,
      createServer,
    });

    const onDisconnect = jest.fn();
    const [serverAndClient, _disconnect] = connector(onDisconnect);

    const port = getMockPort();

    // serverAndClient is connected to port
    const req = serverAndClient.request("example", null);
    port.receiveMessage({ jsonrpc: "2.0", result: "pong", id: 1 });
    await expect(req).resolves.toEqual("pong");

    // the serverAndClient disconnects when the Port is disconnected by the other end
    const req2 = serverAndClient.request("example", null);
    port.receiveDisconnect();

    await expect(req2).rejects.toThrow(
      /Port is disconnected|JSONRPCServerAndClient was unbound from Port/,
    );
    expect(onDisconnect).toHaveBeenCalled();
    expect(port.isDisconnected).toBeTruthy();
  });
});
