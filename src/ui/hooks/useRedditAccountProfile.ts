import { useQuery } from "@tanstack/react-query";

import { useRedditProvider } from "./useRedditProvider";

export function useRedditUserProfile() {
  const { isAvailable, redditProvider } = useRedditProvider();
  return {
    ...useQuery({
      queryKey: ["RedditProvider", "UserProfile"],
      // TODO: rename getUserProfile => getAccountProfile. Account = me, user = other.
      queryFn: () => redditProvider.getUserProfile(),
      enabled: isAvailable,
    }),
    isRedditAvailable: isAvailable,
  };
}
