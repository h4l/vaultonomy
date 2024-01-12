import { RedditProvider } from "../../reddit/reddit-interaction-client";
import { REDDIT_INTERACTION } from "../../reddit/reddit-interaction-spec";
import { browser } from "../../webextension";

export type RedditProviderChangedHandler = (
  redditProvider: RedditProvider | undefined,
) => void;
export type Unsubscribe = () => void;

/**
 * Create a RedditProvider for the tabId, passing it to onRedditProviderChanged.
 * If the provider disconnects, onRedditProviderChanged is called again with
 * undefined.
 *
 * Returns an unsubscribe function, which disconnects the RedditProvider,
 * calling onRedditProviderChanged with undefined in the process.
 */
export function subscribeToRedditProvider(
  tabId: number,
  onRedditProviderChanged: RedditProviderChangedHandler,
): Unsubscribe {
  const createdRedditProvider = RedditProvider.from(
    browser.tabs.connect(tabId, { name: REDDIT_INTERACTION }),
  );
  const unbind = createdRedditProvider.emitter.on("disconnected", () => {
    onRedditProviderChanged(undefined);
  });
  onRedditProviderChanged(createdRedditProvider);

  // Clean up
  return () => {
    // This will call onRedditProviderChanged if still connected
    createdRedditProvider.emitter.emit("disconnectSelf");
    unbind();
  };
}
