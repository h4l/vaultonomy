import { useEffect } from "react";

import { RedditProviderError } from "../../reddit/reddit-interaction-client";
import { ErrorCode } from "../../reddit/reddit-interaction-spec";
import { UseRedditAccountResult } from "../hooks/useRedditAccount";
import { useVaultonomyStore } from "./useVaultonomyStore";

/**
 * Save the reddit account's userId to the UI state when it changes.
 *
 * This allows us to load the profile from the reddit-side's session cache when
 * starting from scratch.
 */
export function useStoreCurrentUserId(
  redditAccount: UseRedditAccountResult,
): void {
  const [currentUserId, setCurrentUserId] = useVaultonomyStore((s) => [
    s.currentUserId,
    s.setCurrentUserId,
  ]);

  let latestUserId: string | null | undefined;
  if (
    redditAccount.error instanceof RedditProviderError &&
    redditAccount.error.type === ErrorCode.USER_NOT_LOGGED_IN
  ) {
    latestUserId = null; // clear current user
  } else latestUserId = redditAccount.data?.userID;

  // Persist the most-recent userId as it changes
  useEffect(() => {
    if (latestUserId !== undefined && latestUserId !== currentUserId) {
      setCurrentUserId(latestUserId);
    }
  }, [latestUserId]);
}
