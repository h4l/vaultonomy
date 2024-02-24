import { useQueries } from "@tanstack/react-query";

import { RedditProviderError } from "../../reddit/reddit-interaction-client";
import { ErrorCode } from "../../reddit/reddit-interaction-spec";
import { useVaultonomyStore } from "../state/useVaultonomyStore";
import { assumeAvailable, useRedditProvider } from "./useRedditProvider";

export type UseRedditAccountResult = ReturnType<typeof useRedditAccount>;

function canRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof RedditProviderError) {
    switch (error.type) {
      // Dont' retry these, as they indicate unexpected state rather than a
      // temporary error that will resolve without intervention.
      case ErrorCode.USER_NOT_LOGGED_IN:
      case ErrorCode.WRONG_USER:
        return false;
    }
  }
  return failureCount < 3;
}

export function useRedditAccount() {
  const { isAvailable, redditProvider } = useRedditProvider();
  const currentUserId = useVaultonomyStore((s) => s.currentUserId);

  // We use this hook / these queries to pro-actively notice when the user logs
  // out of Reddit, or the user changes. We do this by making two concurrent
  // requests, one for the last-seen userId, which can be served from cache. And
  // another to fetch the current user session, not from cache. (The cache is on
  // the reddit side, not the tanstack query cache).
  //
  // Because these queries are refreshed in the background when the user focuses
  // our UI, we can rely on them to cause us to notice when a user has logged
  // out or changed on the Reddit side, without actively polling Reddit.
  //
  // We won't actually make two queries to Reddit, as we aggregate concurrent
  // queries on the Reddit side, and the :cached query can also be served from
  // our cache without making a request to reddit.
  const redditAccount = useQueries({
    queries: [
      {
        queryKey: ["RedditProvider", "UserProfile:cached", currentUserId],
        enabled: isAvailable && !!currentUserId,
        queryFn: () =>
          assumeAvailable(redditProvider).getUserProfile({
            session: currentUserId ? { userId: currentUserId } : null,
          }),
        retry: canRetry,
      },
      {
        queryKey: ["RedditProvider", "UserProfile:current"],
        enabled: isAvailable,
        // by providing session: null we always revalidate
        queryFn: () =>
          assumeAvailable(redditProvider).getUserProfile({ session: null }),
        retry: canRetry,
      },
    ],
    combine: ([cached, current]) => {
      if (
        current.isSuccess ||
        // If the revalidated response shows the user is not logged in, we
        // should respect that and stop using the cached user.
        (current.isError &&
          current.error instanceof RedditProviderError &&
          current.error.type === ErrorCode.USER_NOT_LOGGED_IN)
      ) {
        return current;
      }
      return cached;
    },
  });

  return {
    ...redditAccount,
    isRedditAvailable: isAvailable,
  };
}
