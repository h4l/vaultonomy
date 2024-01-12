import { z } from "zod";

import { assertUnreachable } from "../../assert";
import { log } from "../../logging";
import {
  RedditTabBecameAvailableEvent,
  RedditTabBecameUnavailableEvent,
  UINeedsRedditTabEvent,
} from "../../messaging";
import { browser } from "../../webextension";

import.meta.url;

const RedditTabEvent = z.discriminatedUnion("type", [
  RedditTabBecameAvailableEvent,
  RedditTabBecameUnavailableEvent,
]);
type RedditTabEvent = z.infer<typeof RedditTabEvent>;

export type RedditTabChangedHandler = (tabId: number | undefined) => void;
export type Unsubscribe = () => void;

export function subscribeToRedditTabAvailability(
  onRedditTabIdChanged: RedditTabChangedHandler,
): Unsubscribe {
  let currentTabId: number | undefined;
  const onMessageHandler = (message: unknown) => {
    // Message can something other than the one we handle
    const result = RedditTabEvent.safeParse(message);
    if (!result.success) {
      if (import.meta.env.MODE === "development") {
        log.debug(
          "subscribeToRedditTabAvailability(): ignored message",
          message,
        );
      }
      return;
    }
    log.info("subscribeToRedditTabAvailability", result.data);
    switch (result.data.type) {
      case "redditTabBecameAvailable":
        onRedditTabIdChanged(result.data.tabId);
        break;
      case "redditTabBecameUnavailable":
        if (currentTabId === result.data.tabId) {
          onRedditTabIdChanged(undefined);
        }
        break;
      default:
        assertUnreachable(result.data);
    }
  };
  browser.runtime.onMessage.addListener(onMessageHandler);

  // FIXME: backend responds to this msg inline rather than re-broadcasting
  // Request the background worker re-send the current tab, in case it's already
  // connected.
  browser.runtime.sendMessage<UINeedsRedditTabEvent>({
    type: "uiNeedsRedditTab",
  });

  return () => {
    browser.runtime.onMessage.removeListener(onMessageHandler);
  };
}
