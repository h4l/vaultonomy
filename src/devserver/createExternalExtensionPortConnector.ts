import { PortName } from "../PortName";
import { Connector } from "../rpc/connections";
import { createRawPortConnector } from "../webextensions/createRawPortConnector";
import { createVaultonomyPortFromOutsideExtension } from "./createVaultonomyPortFromOutsideExtension";

export function createExternalExtensionPortConnector(
  portName: PortName,
): Connector<chrome.runtime.Port> {
  return createRawPortConnector(() =>
    createVaultonomyPortFromOutsideExtension({
      name: portName.withRandomTag().toString(),
    }),
  );
}
