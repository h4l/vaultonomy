import { isOnDevServer } from "../../devserver/isOnDevServer";
// TODO: verify that tree shaking removes this this from production builds
import { useInjectedRedditProvider } from "../../devserver/useInjectedRedditProvider";
import { RedditProvider } from "../../reddit/reddit-interaction-client";
import { useConnectedRedditTab } from "./useConnectedRedditTab";
import { useExtensionPortRedditProvider } from "./useExtensionPortRedditProvider";

/**
 * Use the available RedditProvider to communicate with Reddit APIs.
 *
 * When running from a dev server, this returns the RedditProvider injected by
 * the extension. When running in release mode (built as a standalone browser
 * extension) this actively creates the provider by connecting to the available
 * Reddit tab with a chrome.runtime.Port.
 */
export function useRedditProvider(): RedditProvider | undefined {
  if (import.meta.env.MODE === "development" && isOnDevServer()) {
    return useInjectedRedditProvider();
  }
  const tabId = useConnectedRedditTab();
  return useExtensionPortRedditProvider(tabId);
}
