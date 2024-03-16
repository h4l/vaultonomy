import { useEffect } from "react";

import { assert, assertUnreachable } from "../../assert";
import { log } from "../../logging";
import { ErrorCode } from "../../reddit/reddit-interaction-spec";
import { CouldNotConnect } from "../../rpc/connections";
import { useVaultonomyStore } from "../state/useVaultonomyStore";
import { createVaultonomyBackgroundProvider } from "./createVaultonomyBackgroundProvider";

export function useVaultonomyBackgroundConnection() {
  const [
    isOnDevServer,
    setProvider,
    removeProvider,
    setRedditProvider,
    removeRedditProvider,
    onRedditLoggedOut,
    onRedditNotLoggedOut,
    setAutomaticUserSearchUsername,
  ] = useVaultonomyStore((s) => [
    s.isOnDevServer,
    s.setProvider,
    s.removeProvider,
    s.setRedditProvider,
    s.removeRedditProvider,
    s.onRedditLoggedOut,
    s.onRedditNotLoggedOut,
    s.setAutomaticUserSearchUsername,
  ]);
  useEffect(() => {
    let stopped = false;
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
        if (stopped) return;
        if (e.type === "redditTabBecameAvailable")
          setRedditProvider(createdProvider.redditProvider);
        else if (e.type === "redditTabBecameUnavailable")
          removeRedditProvider(createdProvider.redditProvider);
        else assertUnreachable(e);
      },
    );
    createdProvider.requestAvailabilityStatus().catch((e) => {
      // react strict mode stops the connection before the request starts
      if (stopped) return;
      log.error("requestAvailabilityStatus() failed:", e);
    });

    const stopRequestFailed = createdProvider.redditProvider.emitter.on(
      "requestFailed",
      (e) => {
        if (stopped) return;
        if (e.type === ErrorCode.USER_NOT_LOGGED_IN) {
          onRedditLoggedOut();
        } else {
          onRedditNotLoggedOut();
        }
      },
    );
    const stopRequestSucceeded = createdProvider.redditProvider.emitter.on(
      "requestSucceeded",
      () => onRedditNotLoggedOut(),
    );

    const stopOnUserLinkInteraction = createdProvider.emitter.on(
      "userLinkInteraction",
      (event) => {
        if (event.interest === "interested" && event.dwellTime > 450) {
          setAutomaticUserSearchUsername(event.username);
        }
      },
    );
    const stopOnUserPageInteraction = createdProvider.emitter.on(
      "userPageInteraction",
      (event) => setAutomaticUserSearchUsername(event.username),
    );

    return () => {
      stopped = true;
      stopAvailabilityStatus();
      stopRequestFailed();
      stopRequestSucceeded();
      stopOnUserLinkInteraction();
      stopOnUserPageInteraction();
      createdProvider.disconnect();
      removeProvider(createdProvider);
      removeRedditProvider(createdProvider.redditProvider);
    };
  }, []);
}
