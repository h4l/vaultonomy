import { PortName } from "../PortName";
import { Connector } from "../rpc/connections";
import { browser } from "../webextension";
import { createRawPortConnector } from "./createRawPortConnector";

export function createExtensionPortConnector(
  portName: PortName,
): Connector<chrome.runtime.Port> {
  return createRawPortConnector(() =>
    browser.runtime.connect({ name: portName.withRandomTag().toString() }),
  );
}

export function createContentScriptPortConnector(options: {
  tabId: number;
  portName: PortName;
}): Connector<chrome.runtime.Port> {
  return createRawPortConnector(() =>
    browser.tabs.connect(options.tabId, {
      name: options.portName.withRandomTag().toString(),
    }),
  );
}
