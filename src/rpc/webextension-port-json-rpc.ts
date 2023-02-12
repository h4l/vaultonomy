import {
  JSONRPCClient,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCServer,
  SendRequest,
} from "json-rpc-2.0";

type Unbind = () => void;

export function bindPortToJSONRPCServer({
  port,
  server,
}: {
  port: chrome.runtime.Port;
  server: JSONRPCServer;
}): Unbind {
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
  port: chrome.runtime.Port
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
  let disconnected = false;
  const unbind = (message: string) => {
    if (disconnected) return;
    port.onDisconnect.removeListener(onDisconnect);
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

  port.onDisconnect.addListener(onDisconnect);
  port.onMessage.addListener(onMessage);

  return () => {
    unbind("JSONRPCClient was unbound from Port");
  };
}
