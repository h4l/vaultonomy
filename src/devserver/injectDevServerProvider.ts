import { RedditProvider } from "../reddit/reddit-interaction-client";
import {
  Unsubscribe,
  subscribeToRedditTabAvailability,
} from "../ui/state/subscribeToRedditTabAvailability";
import { subscribeToRedditProvider } from "../ui/state/subscribeToReditProvider";
import {
  VaultonomyProviderInfo,
  announceProviderEventType,
  requestProviderEventType,
} from "./interface";

type Disconnect = () => void;

/**
 * Expose the extension's RedditProvider to the dev server page using
 * EIP-6963-style announce/request window events.
 *
 * @see ./interface.ts.
 */
export function injectDevServerProvider(): Disconnect {
  let unsubscribeTab: Unsubscribe | undefined;
  let unsubscribeProvider: Unsubscribe | undefined;
  let stopBroadcastingProvider: Unsubscribe | undefined;

  const cleanupTab = () => {
    cleanupProvider();
    if (unsubscribeTab) unsubscribeTab();
  };
  const cleanupProvider = () => {
    cleanupProviderBroadcaster();
    if (unsubscribeProvider) unsubscribeProvider();
  };
  const cleanupProviderBroadcaster = () => {
    if (stopBroadcastingProvider) stopBroadcastingProvider();
  };

  unsubscribeTab = subscribeToRedditTabAvailability((tabId) => {
    cleanupProvider();
    if (!tabId) return;

    unsubscribeProvider = subscribeToRedditProvider(tabId, (provider) => {
      cleanupProvider();
      if (!provider) return;

      stopBroadcastingProvider = broadcastProvider(provider);
    });
  });

  return cleanupTab;
}

/**
 * Broadcast RedditProvider in a similar way to EIP-6963.
 */
function broadcastProvider(provider: RedditProvider): Disconnect {
  const info: VaultonomyProviderInfo = {
    name: "vaultonomy",
    rdns: "eth.vaultonomy",
    uuid: crypto.randomUUID(),
  };
  const announceEvent = new CustomEvent(announceProviderEventType, {
    detail: Object.freeze({ info, provider }),
  });

  const doAnnounce = () => {
    window.dispatchEvent(announceEvent);
  };
  window.addEventListener(requestProviderEventType, doAnnounce);

  // Cleanup
  return () => {
    window.removeEventListener(requestProviderEventType, doAnnounce);
  };
}
