type StopBridging = () => void;

/**
 * Connect two Ports by sending messages received from one to the other.
 *
 * Both ports are disconnected when either side disconnects.
 *
 * @return A function that stops bridging the ports when called (without
 * disconnecting them).
 */
export function bridgePorts(
  portA: chrome.runtime.Port,
  portB: chrome.runtime.Port,
): StopBridging {
  const forwardMessage = (message: any, port: chrome.runtime.Port): void =>
    (port === portA ? portB : portA).postMessage(message);
  const disconnectOther = (port: chrome.runtime.Port) => {
    (port === portA ? portB : portA).disconnect();
  };

  portA.onMessage.addListener(forwardMessage);
  portB.onMessage.addListener(forwardMessage);
  portA.onDisconnect.addListener(disconnectOther);
  portB.onDisconnect.addListener(disconnectOther);

  return () => {
    portA.onMessage.removeListener(forwardMessage);
    portB.onMessage.removeListener(forwardMessage);
    portA.onDisconnect.removeListener(disconnectOther);
    portB.onDisconnect.removeListener(disconnectOther);
  };
}
