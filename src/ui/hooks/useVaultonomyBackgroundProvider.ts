import { useEffect } from "react";

import { assert, assertUnreachable } from "../../assert";
import { useVaultonomyStore } from "../state/useVaultonomyStore";
import { createVaultonomyBackgroundProvider } from "./createVaultonomyBackgroundProvider";

export function useVaultonomyBackgroundConnection() {
  const [
    isOnDevServer,
    provider,
    redditProvider,
    setProvider,
    setRedditProvider,
  ] = useVaultonomyStore((s) => [
    s.isOnDevServer,
    s.provider,
    s.redditProvider,
    s.setProvider,
    s.setRedditProvider,
  ]);
  useEffect(() => {
    assert(
      provider === null,
      "useVaultonomyBackgroundConnection() mounted with a provider already present",
    );
    assert(
      redditProvider === null,
      "useVaultonomyBackgroundConnection() mounted with a redditProvider already present",
    );

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
          setRedditProvider(null);
        else assertUnreachable(e);
      },
    );

    return () => {
      stopAvailabilityStatus();
      createdProvider.disconnect();
      setProvider(null);
      setRedditProvider(null);
    };
  }, []);
}
