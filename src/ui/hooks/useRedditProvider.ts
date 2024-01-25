import { useSyncExternalStore } from "react";

import { RedditProvider } from "../../reddit/reddit-interaction-client";
import { useVaultonomyStore } from "../state/useVaultonomyStore";

type UseRedditProviderResult = {
  isAvailable: boolean;
  redditProvider: RedditProvider;
};
export function useRedditProvider(): UseRedditProviderResult {
  const provider = useVaultonomyStore((s) => s.provider);
  const isAvailable = useSyncExternalStore(
    (callback) => provider.emitter.on("availabilityStatus", callback),
    () => provider.isRedditAvailable,
  );
  return { isAvailable, redditProvider: provider.redditProvider };
}
