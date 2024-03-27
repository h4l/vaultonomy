import {
  JSONRPCClient,
  JSONRPCErrorException,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCServer,
  JSONRPCServerAndClient,
  SendRequest,
} from "json-rpc-2.0";

import { AssertionError } from "../assert";
import { retroactivePortDisconnection } from "../webextensions/retroactivePortDisconnection";
import { AsyncConnector, Connector } from "./connections";

type Unbind = () => void;

type JSONRPCServerOrClient =
  | JSONRPCClient
  | JSONRPCServer
  | JSONRPCServerAndClient;
const bindings = new WeakMap<chrome.runtime.Port, JSONRPCServerOrClient>();

function ensureNotPreviouslyBound(
  port: chrome.runtime.Port,
  serverOrClient: JSONRPCClient | JSONRPCServer | JSONRPCServerAndClient,
) {
  const existing = bindings.get(port);
  if (existing !== undefined) {
    if (existing === serverOrClient) {
      throw new AssertionError(
        `Attempted to bind a previously-bound port ${port.name} to the same target: ${serverOrClient}`,
      );
    }
    throw new AssertionError(
      `Attempted to bind a previously-bound port ${port.name} to two different targets. Existing: ${existing}, latest: ${serverOrClient}`,
    );
  }
  bindings.set(port, serverOrClient);
}

/**
 * Check if an error is caused by a Port connection being lost while a request
 * was ongoing.
 */
export function isDisconnectedError(e: JSONRPCErrorException): boolean {
  return (
    e.code === 0 &&
    (e.message.startsWith(CLIENT_UNBOUND_MESSAGE) ||
      e.message.startsWith(PORT_DISCONNECTED_MESSAGE) ||
      e.message.startsWith(SERVERANDCLIENT_UNBOUND_MESSAGE))
  );
}

export function bindPortToJSONRPCServer({
  port,
  server,
}: {
  port: chrome.runtime.Port;
  server: JSONRPCServer;
}): Unbind {
  ensureNotPreviouslyBound(port, server);

  const listener = async (message: unknown) => {
    const response = await server.receive(message as JSONRPCRequest);
    if (response !== null) port.postMessage(response);
  };
  port.onMessage.addListener(listener);
  return () => {
    port.onMessage.removeListener(listener);
  };
}

export function createPortSendRequestFn(
  port: chrome.runtime.Port,
): SendRequest<void> {
  return async (payload) => {
    port.postMessage(payload);
  };
}

const PORT_DISCONNECTED_MESSAGE = "Port is disconnected";
const CLIENT_UNBOUND_MESSAGE = "JSONRPCClient was unbound from Port";

export function bindPortToJSONRPCClient({
  port,
  client,
}: {
  port: chrome.runtime.Port;
  client: JSONRPCClient;
}): Unbind {
  ensureNotPreviouslyBound(port, client);

  let disconnected = false;
  const unbind = (message: string) => {
    if (disconnected) return;
    unbindDisconnect();
    port.onMessage.removeListener(onMessage);
    client.rejectAllPendingRequests(message);
    disconnected = true;
  };
  const onDisconnect = () => {
    unbind(PORT_DISCONNECTED_MESSAGE);
  };
  const onMessage = (message: unknown) => {
    client.receive(message as JSONRPCResponse);
  };

  const unbindDisconnect =
    retroactivePortDisconnection.addRetroactiveDisconnectListener(
      port,
      onDisconnect,
    );
  port.onMessage.addListener(onMessage);

  return () => {
    unbind(`${CLIENT_UNBOUND_MESSAGE} at ${new Date().toISOString()}`);
  };
}

const SERVERANDCLIENT_UNBOUND_MESSAGE =
  "JSONRPCServerAndClient was unbound from Port";

export function bindPortToJSONRPCServerAndClient({
  port,
  serverAndClient,
}: {
  port: chrome.runtime.Port;
  serverAndClient: JSONRPCServerAndClient;
}): Unbind {
  ensureNotPreviouslyBound(port, serverAndClient);

  let disconnected = false;
  const unbind = (message: string) => {
    if (disconnected) return;
    unbindDisconnect();
    port.onMessage.removeListener(onMessage);
    serverAndClient.rejectAllPendingRequests(message);
    disconnected = true;
  };
  const onDisconnect = () => {
    unbind(PORT_DISCONNECTED_MESSAGE);
  };
  const onMessage = (message: unknown) => {
    serverAndClient.receiveAndSend(message);
  };

  const unbindDisconnect =
    retroactivePortDisconnection.addRetroactiveDisconnectListener(
      port,
      onDisconnect,
    );
  port.onMessage.addListener(onMessage);

  return () => {
    unbind(SERVERANDCLIENT_UNBOUND_MESSAGE);
  };
}

export function createDefaultClient(port: chrome.runtime.Port): JSONRPCClient {
  const client = new JSONRPCClient(createPortSendRequestFn(port));
  return client;
}

export function createJSONRPCServerAndClientPortConnector({
  portConnector,
  createServer,
  createClient = createDefaultClient,
}: {
  portConnector: Connector<chrome.runtime.Port>;
  createServer(): JSONRPCServer;
  createClient?: (port: chrome.runtime.Port) => JSONRPCClient;
}): Connector<JSONRPCServerAndClient> {
  return (onDisconnect) => {
    let disconnectCalled = false;

    const disconnect = () => {
      if (disconnectCalled) return;
      disconnectCalled = true;
      disconnectPort();
      unbindFromPort();
      onDisconnect && onDisconnect();
    };

    const [port, disconnectPort] = portConnector(() => disconnect());

    const serverAndClient = new JSONRPCServerAndClient(
      createServer(),
      createClient(port),
    );

    const unbindFromPort = bindPortToJSONRPCServerAndClient({
      port,
      serverAndClient: serverAndClient,
    });

    return [serverAndClient, disconnect];
  };
}

export function createJSONRPCClientPortConnector({
  portConnector,
  createClient = createDefaultClient,
}: {
  portConnector: Connector<chrome.runtime.Port>;
  createClient?: (port: chrome.runtime.Port) => JSONRPCClient;
}): Connector<JSONRPCClient> {
  return (onDisconnect) => {
    let disconnectCalled = false;

    const disconnect = () => {
      if (disconnectCalled) return;
      disconnectCalled = true;

      disconnectPort();
      unbindFromPort();
      onDisconnect && onDisconnect();
    };

    const [port, disconnectPort] = portConnector(disconnect);

    const client = createClient(port);
    const unbindFromPort = bindPortToJSONRPCClient({ port, client });

    return [client, disconnect];
  };
}

export function createJSONRPCClientPortConnectorAsync({
  portConnector,
  createClient = createDefaultClient,
}: {
  portConnector: AsyncConnector<chrome.runtime.Port>;
  createClient?: (port: chrome.runtime.Port) => JSONRPCClient;
}): AsyncConnector<JSONRPCClient> {
  return async (onDisconnect) => {
    let disconnectCalled = false;
    const disconnect = () => {
      if (disconnectCalled) return;
      disconnectCalled = true;
      disconnectPort();
      unbindFromPort();
      onDisconnect && onDisconnect();
    };
    const [port, disconnectPort] = await portConnector(disconnect);

    const client = createClient(port);
    const unbindFromPort = bindPortToJSONRPCClient({ port, client });

    return [client, disconnect];
  };
}
