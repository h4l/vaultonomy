import { queryOptions, useQuery } from "@tanstack/react-query";

import {
  RedditProvider,
  RedditProviderError,
} from "../../reddit/reddit-interaction-client";
import {
  ErrorCode,
  RedditUserProfile,
} from "../../reddit/reddit-interaction-spec";
import { AnyRedditUserProfile } from "../../reddit/types";
import { RequiredNonNullable } from "../../types";
import { useVaultonomyStore } from "../state/useVaultonomyStore";
import { useRedditProvider } from "./useRedditProvider";

export type UseRedditUserProfileParameters = { username: string | undefined };

export type GetRedditUserProfileQueryOptions =
  UseRedditUserProfileParameters & {
    session: { userId: string } | undefined;
    redditProvider: RedditProvider | undefined;
  };

function isEnabled(
  options: GetRedditUserProfileQueryOptions,
): options is RequiredNonNullable<GetRedditUserProfileQueryOptions> {
  return !!(options.redditProvider && options.session && options.username);
}

// TODO: we don't need a session to fetch another user's profile

export function getRedditUserProfileQueryOptions(
  options: GetRedditUserProfileQueryOptions,
) {
  return queryOptions({
    queryKey: ["RedditProvider", "UserProfile", options.username],
    async queryFn(): Promise<AnyRedditUserProfile | null> {
      if (!isEnabled(options)) throw new Error("not enabled");
      const { redditProvider, session, username } = options;
      try {
        return await redditProvider.getUserProfile({
          session,
          username,
        });
      } catch (error) {
        if (
          error instanceof RedditProviderError &&
          error.type === ErrorCode.NOT_FOUND
        ) {
          return null;
        }
        throw error;
      }
    },
    staleTime: 1000 * 30,
    enabled: isEnabled(options),
  });
}

export function useRedditUserProfile({
  username,
}: Partial<UseRedditUserProfileParameters>) {
  const currentUserId = useVaultonomyStore((s) => s.currentUserId);
  const { redditProvider } = useRedditProvider();

  const options = {
    redditProvider: redditProvider ?? undefined,
    session: currentUserId ? { userId: currentUserId } : undefined,
    username,
  };
  return useQuery({
    ...getRedditUserProfileQueryOptions(options),
  });
}
