import { log } from "../logging";
import { devModeRedditInteractionProxyPort } from "../messaging";
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
  // FIXME: detail is null on receiving side — can't transfer a Port across the
  // content script -> page boundary. We need to use the externally_connectable
  // permission to give the page permission to connect directly to the background
  // worker: https://developer.chrome.com/docs/extensions/develop/concepts/messaging#external-webpage
  // Alternatively, can we can use the web postMessage API? This would require
  // an extra proxying step in the content script though.
  //
  // Seems that MetaMask uses postMessage communicate from the page to the extension:
  // https://github.com/MetaMask/metamask-extension/blob/develop/app/scripts/inpage.js
  const announceEvent = new CustomEvent(announceProviderEventType, {
    detail: Object.freeze({ info, provider }),
  });

  const doAnnounce = () => {
    log.debug(
      "injectDevServerProvider: sending",
      announceEvent.type,
      announceEvent,
    );
    window.dispatchEvent(announceEvent);
  };
  window.addEventListener(requestProviderEventType, (e) => {
    log.debug("injectDevServerProvider: received", e.type, e);
    doAnnounce();
  });
  doAnnounce();

  // Cleanup
  return () => {
    window.removeEventListener(requestProviderEventType, doAnnounce);
  };
}
