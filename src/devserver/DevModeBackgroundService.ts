import { assert } from "../assert";
import { BackgroundService } from "../background/BackgroundService";
import { log } from "../logging";
import { Stop } from "../types";
import { VAULTONOMY_RPC_PORT } from "../vaultonomy-rpc-spec";
import { browser } from "../webextension";
import { retroactivePortDisconnection } from "../webextensions/retroactivePortDisconnection";
import { isDevServerSender } from "./isDevServerSender";

export class DevModeBackgroundService extends BackgroundService {
  start(): void {
    if (this.isStarted) return;
    super.start();

    this.toStop.push(this.startHandlingExternalConnection());
  }

  private startHandlingExternalConnection(): Stop {
    const onConnect = (port: chrome.runtime.Port) => {
      retroactivePortDisconnection.register(port);
      this.handleExternalConnection(port);
    };

    assert(!browser.runtime.onConnectExternal.hasListeners());
    browser.runtime.onConnectExternal.addListener(onConnect);

    return () => browser.runtime.onConnectExternal.removeListener(onConnect);
  }

  protected handleExternalConnection(port: chrome.runtime.Port) {
    if (
      port.sender &&
      isDevServerSender(port.sender) &&
      VAULTONOMY_RPC_PORT.matches(port.name)
    ) {
      log.debug(`Received ${VAULTONOMY_RPC_PORT} connection from dev-server`);
      this.handleExtensionConnection(port);
    } else {
      log.debug("Disconnecting unexpected external connection:", port);
      port.disconnect();
    }
  }
}
