import { jest } from "@jest/globals";

import { MockPort } from "../../__tests__/webextension.mock";

import { nextTickPromise } from "../../__tests__/testing.utils";
import { assert } from "../../assert";
import { createRawPortConnector } from "../../webextensions/createRawPortConnector";
import {
  AsyncConnector,
  Connector,
  CouldNotConnect,
  ReconnectingAsyncManagedConnection,
  ReconnectingManagedConnection,
  mapConnection,
} from "../connections";

const connectMockPortRaw = jest.fn(() => new MockPort());

const mockTabConnector: Connector<chrome.runtime.Port> =
  createRawPortConnector(connectMockPortRaw);

const asyncMockTabConnector: AsyncConnector<chrome.runtime.Port> = async (
  onDisconnect,
) => {
  await nextTickPromise();
  return mockTabConnector(onDisconnect);
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("ReconnectingManagedConnection", () => {
  test("getConnection returns a connected connection, reconnecting only after disconnect", async () => {
    const managedConnection = new ReconnectingManagedConnection(
      mockTabConnector,
    );

    const port1 = managedConnection.getConnection();

    expect(connectMockPortRaw).toHaveBeenCalledTimes(1);
    expect(port1).toBe(connectMockPortRaw.mock.results[0].value);

    // Same connection is returned because it's not disconnected
    const port2 = managedConnection.getConnection();

    expect(connectMockPortRaw).toHaveBeenCalledTimes(1);
    expect(port1).toBe(port2);

    // simulate other end disconnecting
    (port1 as MockPort).receiveDisconnect();

    // disconnect happens on next tick
    await jest.advanceTimersToNextTimerAsync();

    // Now we reconnect and receive a new connection
    const port3 = managedConnection.getConnection();

    expect(connectMockPortRaw).toHaveBeenCalledTimes(2);
    expect(port1).not.toBe(port3);
    expect(port3).toBe(connectMockPortRaw.mock.results[1].value);
  });

  test("emits disconnected event when port is disconnected by the other side", async () => {
    const managedConnection = new ReconnectingManagedConnection(
      mockTabConnector,
    );
    const onDisconnected = jest.fn();
    managedConnection.emitter.on("disconnected", onDisconnected);

    const port1 = managedConnection.getConnection();

    // simulate other end disconnecting
    (port1 as MockPort).receiveDisconnect();

    // disconnect happens on next tick
    await jest.advanceTimersToNextTimerAsync();

    expect(onDisconnected).toHaveBeenCalledTimes(1);
  });

  test("emits disconnected event when port is disconnected by disconnect()", async () => {
    const managedConnection = new ReconnectingManagedConnection(
      mockTabConnector,
    );
    const onDisconnected = jest.fn();
    managedConnection.emitter.on("disconnected", onDisconnected);

    const port1 = managedConnection.getConnection();

    managedConnection.disconnect(port1);

    expect(onDisconnected).toHaveBeenCalledTimes(1);
  });

  test("stop disconnects current connection and prevents future connections", async () => {
    const managedConnection = new ReconnectingManagedConnection(
      mockTabConnector,
    );

    const onDisconnected = jest.fn();
    const onStopped = jest.fn();
    managedConnection.emitter.on("disconnected", onDisconnected);
    managedConnection.emitter.on("stopped", onStopped);

    const port1 = managedConnection.getConnection();

    managedConnection.stop();
    expect(onDisconnected).toHaveBeenCalledWith(port1);
    expect(onStopped).toHaveBeenCalled();

    // new connection attempts now fail
    expect(() => managedConnection.getConnection()).toThrow(CouldNotConnect);
    expect(() => managedConnection.getConnection()).toThrow("stopped");

    // The port is disconnected by us
    expect((port1 as MockPort).isDisconnected).toBeTruthy();
  });
});

describe("mapConnection", () => {
  class PortUtiliser {
    constructor(public readonly port: chrome.runtime.Port) {}
  }

  const createPortUtiliser = jest.fn(
    (port: chrome.runtime.Port): PortUtiliser => new PortUtiliser(port),
  );

  test("applies map fn once per connection instance", () => {
    const managedConnection = new ReconnectingManagedConnection(
      mockTabConnector,
    );
    const mappedCon = mapConnection(managedConnection, createPortUtiliser);

    const onDisconnected = jest.fn();
    const onStopped = jest.fn();
    mappedCon.emitter.on("disconnected", onDisconnected);
    mappedCon.emitter.on("stopped", onStopped);

    const pu1 = mappedCon.getConnection();
    const pu2 = mappedCon.getConnection();

    expect(pu1).toBe(pu2);
    expect(createPortUtiliser).toHaveBeenCalledTimes(1);
    expect(pu1.port).toBe(connectMockPortRaw.mock.results[0].value);

    mappedCon.disconnect(pu1);

    expect((pu1.port as MockPort).isDisconnected).toBeTruthy();
    expect(onDisconnected).toHaveBeenCalledWith(pu1);

    const pu3 = mappedCon.getConnection();

    expect(pu3).not.toBe(pu1);
    expect(createPortUtiliser).toHaveBeenCalledTimes(2);
    expect(pu3.port).toBe(connectMockPortRaw.mock.results[1].value);

    mappedCon.stop();
    expect(onStopped).toHaveBeenCalled();

    // current connection is disconnected on stop
    expect((pu3.port as MockPort).isDisconnected).toBeTruthy();
    expect(onDisconnected).toHaveBeenCalledWith(pu3);

    // getConnection throws now that we've stopped
    expect(() => mappedCon.getConnection()).toThrow(CouldNotConnect);
    expect(() => mappedCon.getConnection()).toThrow("stopped");
  });
});

describe("ReconnectingAsyncManagedConnection", () => {
  test("getConnection returns a connected connection, reconnecting only after disconnect", async () => {
    const managedConnection = new ReconnectingAsyncManagedConnection(
      asyncMockTabConnector,
    );

    const port1 = await managedConnection.getConnection();

    expect(connectMockPortRaw).toHaveBeenCalledTimes(1);
    expect(port1).toBe(connectMockPortRaw.mock.results[0].value);

    // Same connection is returned because it's not disconnected
    const port2 = await managedConnection.getConnection();

    expect(connectMockPortRaw).toHaveBeenCalledTimes(1);
    expect(port1).toBe(port2);

    // simulate other end disconnecting
    (port1 as MockPort).receiveDisconnect();

    // disconnect happens on next tick
    await jest.advanceTimersToNextTimerAsync();

    // Now we reconnect and receive a new connection
    const port3 = await managedConnection.getConnection();

    expect(connectMockPortRaw).toHaveBeenCalledTimes(2);
    expect(port1).not.toBe(port3);
    expect(port3).toBe(connectMockPortRaw.mock.results[1].value);
  });

  test("emits disconnected event when port is disconnected by the other side", async () => {
    const managedConnection = new ReconnectingAsyncManagedConnection(
      asyncMockTabConnector,
    );
    const onDisconnected = jest.fn();
    managedConnection.emitter.on("disconnected", onDisconnected);

    const port1 = await managedConnection.getConnection();

    // simulate other end disconnecting
    (port1 as MockPort).receiveDisconnect();

    // disconnect happens on next tick
    await jest.advanceTimersToNextTimerAsync();

    expect(onDisconnected).toHaveBeenCalledTimes(1);
  });

  test("emits disconnected event when port is disconnected by disconnect()", async () => {
    const managedConnection = new ReconnectingAsyncManagedConnection(
      asyncMockTabConnector,
    );
    const onDisconnected = jest.fn();
    managedConnection.emitter.on("disconnected", onDisconnected);

    const port1 = await managedConnection.getConnection();

    managedConnection.disconnect(port1);

    expect(onDisconnected).toHaveBeenCalledTimes(1);
  });

  test("onConnect throws CouldNotConnect if disconnected while connecting", async () => {
    const port = new MockPort();
    let resolve: undefined | ((value: MockPort) => void);
    const futurePort = new Promise<MockPort>((r) => {
      resolve = r;
    });
    assert(resolve);

    const managedConnection = new ReconnectingAsyncManagedConnection(
      async (onDisconnect) => {
        const port = await futurePort;
        return createRawPortConnector(() => port)(onDisconnect);
      },
    );

    const onDisconnected = jest.fn();
    managedConnection.emitter.on("disconnected", onDisconnected);

    const result = managedConnection.getConnection();

    managedConnection.disconnect(result);

    // disconnect event is not emitted until the connection promise resolves
    await jest.advanceTimersToNextTimerAsync();
    expect(onDisconnected).not.toHaveBeenCalled();

    resolve(port);
    await jest.advanceTimersToNextTimerAsync();

    expect(onDisconnected).toHaveBeenCalledTimes(1);
    // The port is disconnected by us
    expect(port.isDisconnected).toBeTruthy();

    await expect(result).rejects.toThrow(CouldNotConnect);
    await expect(result).rejects.toThrow("disconnected while connecting");
  });

  test("stop disconnects current connection and prevents future connections", async () => {
    const port = new MockPort();
    let resolve: undefined | ((value: MockPort) => void);
    const futurePort = new Promise<MockPort>((r) => {
      resolve = r;
    });
    assert(resolve);

    const managedConnection = new ReconnectingAsyncManagedConnection(
      async (onDisconnect) => {
        const port = await futurePort;
        return createRawPortConnector(() => port)(onDisconnect);
      },
    );

    const onDisconnected = jest.fn();
    const onStopped = jest.fn();
    managedConnection.emitter.on("disconnected", onDisconnected);
    managedConnection.emitter.on("stopped", onStopped);

    const result1 = managedConnection.getConnection();

    managedConnection.stop();
    expect(onStopped).toHaveBeenCalled();

    // new connection attempts now fail
    const result2 = managedConnection.getConnection();
    await expect(result2).rejects.toThrow(CouldNotConnect);
    await expect(result2).rejects.toThrow("stopped");

    // The original result rejects once it connects
    await expect(Promise.race([result1, Promise.resolve(2)])).resolves.toBe(2);

    resolve(port);
    await jest.advanceTimersToNextTimerAsync();

    expect(onDisconnected).toHaveBeenCalledTimes(1);
    // The port is disconnected by us
    expect(port.isDisconnected).toBeTruthy();

    await expect(result1).rejects.toThrow(CouldNotConnect);
    await expect(result1).rejects.toThrow("disconnected while connecting");
  });
});
