import { useEffect, useState } from "react";

import { assert } from "../assert";
import { RedditProvider } from "../reddit/reddit-interaction-client";
import {
  VaultonomyProviderDetail,
  announceProviderEventType,
  isVaultonomyAnnounceProviderEvent,
  requestProviderEventType,
} from "./interface";

/**
 * A react hook that provides the RedditProvider injected into the dev server
 * page by the Vaultonomy extension — only in development builds.
 */
export function useInjectedRedditProvider(): RedditProvider | undefined {
  const [providerDetail, setProviderDetail] =
    useState<VaultonomyProviderDetail>();

  useEffect(() => {
    const onProviderAvailable = (event: unknown) => {
      assert(isVaultonomyAnnounceProviderEvent(event));
      if (providerDetail?.info.uuid === event.detail.info.uuid) {
        console.info(
          `useRedditProvider: ignored repeated ${onProviderAvailable}`,
          event,
        );
      } else {
        setProviderDetail(event.detail);
      }
    };
    // The extension broadcasts its RedditProvider with this event when it
    // starts, and when we send a request event.
    window.addEventListener(announceProviderEventType, onProviderAvailable);
    // Request the extension re-broadcast in case it broadcast before we started
    // listening.
    window.dispatchEvent(new Event(requestProviderEventType));

    // Clean up
    return () => {
      window.removeEventListener(
        announceProviderEventType,
        onProviderAvailable,
      );
    };
  }, []);

  return providerDetail?.provider;
}
