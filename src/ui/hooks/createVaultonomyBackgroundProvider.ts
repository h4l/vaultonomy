import { createVaultonomyPortFromOutsideExtension } from "../../devserver/createVaultonomyPortFromOutsideExtension";
import { VAULTONOMY_RPC_PORT } from "../../vaultonomy-rpc-spec";
import { browser } from "../../webextension";
import { retroactivePortDisconnection } from "../../webextensions/retroactivePortDisconnection";
import { VaultonomyBackgroundProvider } from "../rpc/VaultonomyBackgroundProvider";

/**
 * Create a VaultonomyBackgroundProvider connected to the background service.
 */
export function createVaultonomyBackgroundProvider(options: {
  isOnDevServer: boolean;
}): VaultonomyBackgroundProvider {
  const { isOnDevServer } = options;
  return new VaultonomyBackgroundProvider(createRpcPort(isOnDevServer));
}

function createRpcPort(isOnDevServer: boolean) {
  if (import.meta.env.MODE === "development" && isOnDevServer) {
    return createVaultonomyPortFromOutsideExtension({
      name: VAULTONOMY_RPC_PORT.withRandomTag().toString(),
    });
  }
  return retroactivePortDisconnection.register(
    browser.runtime.connect({
      name: VAULTONOMY_RPC_PORT.withRandomTag().toString(),
    }),
  );
}
