import { devModeRedditInteractionProxyPort } from "../../messaging";
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
  // In dev mode (running from the HTTP dev-server tab) we can't use
  // browser.tabs APIs, so we proxy through the background service.
  const redditInteractionPort =
    import.meta.env.MODE === "development" && !browser.tabs
      ? browser.runtime.connect({ name: devModeRedditInteractionProxyPort })
      : browser.tabs.connect(tabId, { name: REDDIT_INTERACTION });

  const createdRedditProvider = RedditProvider.from(redditInteractionPort);
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
