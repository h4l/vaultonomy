import { queryOptions, useQuery } from "@tanstack/react-query";

import {
  RedditProvider,
  RedditProviderError,
} from "../../reddit/reddit-interaction-client";
import { ErrorCode } from "../../reddit/reddit-interaction-spec";
import { AnyRedditUserProfile } from "../../reddit/types";
import { useVaultonomyStore } from "../state/useVaultonomyStore";
import { useRedditProvider } from "./useRedditProvider";
import { normaliseUsername } from "./useSearchForUser";

export type UseRedditUserProfileParameters = { username: string | undefined };

export type GetRedditUserProfileQueryOptions =
  UseRedditUserProfileParameters & {
    redditProvider: RedditProvider | undefined;
  };

type EnabledOptions = {
  username: string;
  redditProvider: RedditProvider;
};

function isEnabled(
  options: GetRedditUserProfileQueryOptions,
): options is EnabledOptions {
  return !!(options.redditProvider && options.username);
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

  const options = {
    redditProvider: redditProvider ?? undefined,
    username: username?.toLowerCase(),
  };
  return useQuery({
    ...getRedditUserProfileQueryOptions(options),
  });
}
