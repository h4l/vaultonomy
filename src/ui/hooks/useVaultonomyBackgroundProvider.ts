import { useEffect, useState } from "react";

import { createVaultonomyPortFromOutsideExtension } from "../../devserver/createVaultonomyPortFromOutsideExtension";
import { useIsOnDevServer } from "../../devserver/isOnDevServer";
import { VAULTONOMY_RPC_PORT } from "../../vaultonomy-rpc-spec";
import { browser } from "../../webextension";
import { retroactivePortDisconnection } from "../../webextensions/retroactivePortDisconnection";
import { VaultonomyBackgroundProvider } from "../rpc/VaultonomyBackgroundProvider";

/**
 * Get a VaultonomyBackgroundProvider connected to the background service.
 */
export function useVaultonomyBackgroundProvider():
  | VaultonomyBackgroundProvider
  | undefined {
  const isOnDevServer = useIsOnDevServer();
  const [provider, setProvider] = useState<VaultonomyBackgroundProvider>();
  useEffect(() => {
    const createdProvider = new VaultonomyBackgroundProvider(
      createRpcPort(isOnDevServer),
    );
    setProvider(createdProvider);
    return () => {
      createdProvider.disconnect();
    };
  }, [setProvider, isOnDevServer]);
  return provider;
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
