import { createExternalExtensionPortConnector } from "../../devserver/createExternalExtensionPortConnector";
import { VAULTONOMY_RPC_PORT } from "../../vaultonomy-rpc-spec";
import { createExtensionPortConnector } from "../../webextensions/port-connections";
import { VaultonomyBackgroundProvider } from "../rpc/VaultonomyBackgroundProvider";

/**
 * Create a VaultonomyBackgroundProvider connected to the background service.
 */
export function createVaultonomyBackgroundProvider(options: {
  isOnDevServer: boolean;
}): VaultonomyBackgroundProvider {
  const { isOnDevServer } = options;
  return new VaultonomyBackgroundProvider(
    createRpcPortConnector(isOnDevServer),
  );
}

function createRpcPortConnector(isOnDevServer: boolean) {
  if (VAULTONOMY.releaseTarget === "development" && isOnDevServer) {
    return createExternalExtensionPortConnector(VAULTONOMY_RPC_PORT);
  }
  return createExtensionPortConnector(VAULTONOMY_RPC_PORT);
}
