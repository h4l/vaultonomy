import { useEffect } from "react";

import { assert, assertUnreachable } from "../../assert";
import { log } from "../../logging";
import { useVaultonomyStore } from "../state/useVaultonomyStore";
import { createVaultonomyBackgroundProvider } from "./createVaultonomyBackgroundProvider";

export function useVaultonomyBackgroundConnection() {
  const [
    isOnDevServer,
    setProvider,
    removeProvider,
    setRedditProvider,
    removeRedditProvider,
  ] = useVaultonomyStore((s) => [
    s.isOnDevServer,
    s.setProvider,
    s.removeProvider,
    s.setRedditProvider,
    s.removeRedditProvider,
  ]);
  useEffect(() => {
    const createdProvider = createVaultonomyBackgroundProvider({
      isOnDevServer,
    });
    setProvider(createdProvider);

    if (createdProvider.isRedditAvailable)
      setRedditProvider(createdProvider.redditProvider);

    // Sync redditProvider state with its connection status
    const stopAvailabilityStatus = createdProvider.emitter.on(
      "availabilityStatus",
      (e) => {
        if (e.type === "redditTabBecameAvailable")
          setRedditProvider(createdProvider.redditProvider);
        else if (e.type === "redditTabBecameUnavailable")
          removeRedditProvider(createdProvider.redditProvider);
        else assertUnreachable(e);
      },
    );

    return () => {
      stopAvailabilityStatus();
      createdProvider.disconnect();
      removeProvider(createdProvider);
      removeRedditProvider(createdProvider.redditProvider);
    };
  }, []);
}
