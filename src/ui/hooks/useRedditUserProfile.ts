import { queryOptions, useQuery } from "@tanstack/react-query";

import {
  RedditProvider,
  RedditProviderError,
} from "../../reddit/reddit-interaction-client";
import { ErrorCode } from "../../reddit/reddit-interaction-spec";
import { AnyRedditUserProfile } from "../../reddit/types";
import { useVaultonomyStoreSingle } from "../state/useVaultonomyStore";
import { useRedditProvider } from "./useRedditProvider";
import { normaliseUsername } from "./useSearchForUser";

export type UseRedditUserProfileParameters = { username: string | undefined };

export type GetRedditUserProfileQueryOptions =
  UseRedditUserProfileParameters & {
    redditProvider: RedditProvider | undefined;
    redditWasLoggedOut: boolean | null | undefined;
  };

type EnabledOptions = {
  username: string;
  redditProvider: RedditProvider;
  redditWasLoggedOut: false;
};

function isEnabled(
  options: GetRedditUserProfileQueryOptions,
): options is EnabledOptions {
  return !!(
    options.redditProvider &&
    options.redditWasLoggedOut === false &&
    options.username
  );
}

export function getRedditUserProfileQueryOptions(
  options: GetRedditUserProfileQueryOptions,
) {
  return queryOptions({
    queryKey: [
      "RedditProvider",
      "UserProfile",
      options.username === undefined ?
        undefined
      : normaliseUsername(options.username),
    ],
    async queryFn(): Promise<AnyRedditUserProfile | null> {
      if (!isEnabled(options)) throw new Error("not enabled");
      const { redditProvider, username } = options;
      try {
        const profile = await redditProvider.getUserProfile({ username });
        if (!profile.isSuspended && profile.accountIconFullBodyURL) {
          // Pre-fetch the account icon URL to the browser cache
          new Image().src = profile.accountIconFullBodyURL;
        }
        return profile;
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
  const { redditProvider } = useRedditProvider();
  const redditWasLoggedOut = useVaultonomyStoreSingle(
    (s) => s.redditWasLoggedOut,
  );

  const options = {
    redditProvider: redditProvider ?? undefined,
    username: username?.toLowerCase(),
    redditWasLoggedOut,
  };
  return useQuery({
    ...getRedditUserProfileQueryOptions(options),
  });
}
