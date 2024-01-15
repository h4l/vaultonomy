import { BackgroundService } from "../background/BackgroundService";
import { log } from "../logging";
import { VAULTONOMY_RPC_PORT } from "../vaultonomy-rpc-spec";
import { browser } from "../webextension";
import { isDevServerSender } from "./isDevServerSender";

export class DevModeBackgroundService extends BackgroundService {
  protected initSync(): void {
    super.initSync();

    browser.runtime.onConnectExternal.addListener((port) => {
      this.handleExtensionConnection(port).catch(log.error);
    });
  }

  async handleExternalConnection(port: chrome.runtime.Port) {
    if (
      port.sender &&
      isDevServerSender(port.sender) &&
      port.name === VAULTONOMY_RPC_PORT
    ) {
      log.debug(`Received ${VAULTONOMY_RPC_PORT} connection from dev-server`);
      await this.handleExtensionConnection(port);
    } else {
      log.debug("Disconnecting unexpected external connection:", port);
      port.disconnect();
    }
  }
}
