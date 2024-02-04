import { useQuery } from "@tanstack/react-query";

import {
  RedditProvider,
  RedditProviderError,
} from "../../reddit/reddit-interaction-client";
import { RedditUserProfile } from "../../reddit/reddit-interaction-spec";
import { useRedditProvider } from "./useRedditProvider";

type RedditProviderResult<T extends Record<string, unknown>> =
  | SuccessfulRedditProviderResult<T>
  | FailedRedditProviderResult<T>;
type SuccessfulRedditProviderResult<T extends Record<string, unknown>> = T & {
  error?: undefined;
};
type FailedRedditProviderResult<T extends Record<string, unknown>> = {
  [P in keyof T]?: undefined;
} & { error: RedditProviderError };

export type RedditProfileResult = RedditProviderResult<{
  profile: RedditUserProfile;
}>;

async function getUserProfile(
  redditProvider: RedditProvider,
): Promise<RedditProfileResult> {
  try {
    return { profile: await redditProvider.getUserProfile() };
  } catch (error) {
    if (!(error instanceof RedditProviderError)) throw error;
    return { error };
  }
}

export function useRedditAccount() {
  const { isAvailable, redditProvider } = useRedditProvider();
  return {
    ...useQuery({
      queryKey: ["RedditProvider", "UserProfile"],
      queryFn: () => getUserProfile(redditProvider),
      enabled: isAvailable,
    }),
    isRedditAvailable: isAvailable,
  };
}
