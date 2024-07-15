import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useConfig } from "wagmi";

import { log } from "../../logging";
import { ErrorCode } from "../../reddit/reddit-interaction-spec";
import { useVaultonomyStore } from "../state/useVaultonomyStore";
import { createVaultonomyBackgroundProvider } from "./createVaultonomyBackgroundProvider";
import { useSyncRedditTabAvailabilityWithProviderNotifications } from "./useRedditTabAvailability";
import { useReloadSettingsOnProviderNofication } from "./useReloadVaultonomySettingsOnProviderNotification";
import { parseUsername, prefetchSearchForUser } from "./useSearchForUser";

// FIXME: rename this file to match this fn
export function useVaultonomyBackgroundConnection() {
  const queryClient = useQueryClient();
  const wagmiConfig = useConfig();
  const [
    isOnDevServer,
    redditWasLoggedOut,
    setProvider,
    removeProvider,
    onRedditLoggedOut,
    onRedditNotLoggedOut,
    setUserOfInterest,
  ] = useVaultonomyStore((s) => [
    s.isOnDevServer,
    s.redditWasLoggedOut,
    s.setProvider,
    s.removeProvider,
    s.onRedditLoggedOut,
    s.onRedditNotLoggedOut,
    s.setUserOfInterest,
  ]);

  // We need to know the current logged-out state to decide whether to pre-fetch
  // user search queries, but we don't want to re-bind all the event handlers
  // in response to logging out, so we maintain this state in a mutable ref
  const redditWasLoggedOutRef = useRef<boolean | null>();
  useEffect(() => {
    redditWasLoggedOutRef.current = redditWasLoggedOut;
  }, [redditWasLoggedOut]);

  useEffect(() => {
    let stopped = false;
    const createdProvider = createVaultonomyBackgroundProvider({
      isOnDevServer,
    });
    setProvider(createdProvider);

    const stopRequestFailed = createdProvider.redditProvider.emitter.on(
      "requestFailed",
      (e) => {
        if (stopped) return;
        if (e.type === ErrorCode.USER_NOT_LOGGED_IN) {
          onRedditLoggedOut();
        } else {
          onRedditNotLoggedOut();
        }
        log.warn("Reddit Provider request failed:", e);
      },
    );
    const stopRequestSucceeded = createdProvider.redditProvider.emitter.on(
      "requestSucceeded",
      () => onRedditNotLoggedOut(),
    );

    const stopOnUserLinkInteraction = createdProvider.emitter.on(
      "userLinkInteraction",
      (event) => {
        if (event.interest === "interested") {
          const query = parseUsername(event.username);
          if (query.type === "username") {
            prefetchSearchForUser({
              query,
              queryClient,
              redditProvider: createdProvider.redditProvider,
              redditWasLoggedOut: redditWasLoggedOutRef.current,
              wagmiConfig,
            });
          }
        }
        if (event.interest === "interested" && event.dwellTime > 450) {
          setUserOfInterest({
            rawUsernameQuery: event.username,
            source: "user-link-interaction",
          });
        }
      },
    );
    const stopOnUserPageInteraction = createdProvider.emitter.on(
      "userPageInteraction",
      (event) =>
        setUserOfInterest({
          rawUsernameQuery: event.username,
          source: "user-page-interaction",
        }),
    );

    return () => {
      stopped = true;
      stopRequestFailed();
      stopRequestSucceeded();
      stopOnUserLinkInteraction();
      stopOnUserPageInteraction();
      createdProvider.disconnect();
      removeProvider(createdProvider);
    };
  }, [redditWasLoggedOutRef]);

  // This needs to happen exactly once, so it makes sense to do it here as the
  // provider is created.
  useSyncRedditTabAvailabilityWithProviderNotifications();
  useReloadSettingsOnProviderNofication();
}
