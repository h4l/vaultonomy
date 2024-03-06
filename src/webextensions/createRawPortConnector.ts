import { Connector, Disconnect } from "../rpc/connections";
import { retroactivePortDisconnection } from "./retroactivePortDisconnection";

export function createRawPortConnector(
  connectRaw: () => chrome.runtime.Port,
): Connector<chrome.runtime.Port> {
  return (onDisconnect) => {
    const port = connectRaw();
    retroactivePortDisconnection.register(port);
    let unbindOnDisconnect: Disconnect | undefined = undefined;
    if (onDisconnect) {
      unbindOnDisconnect =
        retroactivePortDisconnection.addRetroactiveDisconnectListener(
          port,
          onDisconnect,
        );
    }
    return [
      port,
      () => {
        port.disconnect();
        unbindOnDisconnect && unbindOnDisconnect();
        // Note that us calling disconnect() does not fire the Port's
        // onDisconnect event. That only fires when the other end disconnects.
        onDisconnect && onDisconnect();
      },
    ];
  };
}
