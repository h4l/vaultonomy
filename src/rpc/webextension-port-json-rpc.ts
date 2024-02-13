import {
  JSONRPCClient,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCServer,
  JSONRPCServerAndClient,
  SendRequest,
} from "json-rpc-2.0";

import { AssertionError } from "../assert";
import { retroactivePortDisconnection } from "../webextensions/retroactivePortDisconnection";

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
    unbind("Port is disconnected");
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
    unbind("JSONRPCClient was unbound from Port");
  };
}

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
    unbind("Port is disconnected");
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
    unbind("JSONRPCServerAndClient was unbound from Port");
  };
}
