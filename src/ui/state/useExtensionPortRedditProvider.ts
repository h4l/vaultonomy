import { useEffect, useState } from "react";

import { RedditProvider } from "../../reddit/reddit-interaction-client";
import { subscribeToRedditProvider } from "./subscribeToReditProvider";

export function useExtensionPortRedditProvider(
  tabId: number | undefined,
): RedditProvider | undefined {
  const [redditProvider, setRedditProvider] = useState<RedditProvider>();

  useEffect(() => {
    if (tabId === undefined) {
      // Don't need to clean up redditProvider here, as our own cleanup fn
      // (returned from subscribeToRedditProvider) will have been called already
      // due to tabId changing.
      setRedditProvider(undefined);
      return;
    }

    return subscribeToRedditProvider(tabId, setRedditProvider);
  }, [tabId]);

  return redditProvider;
}
