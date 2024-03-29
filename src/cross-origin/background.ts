import { log } from "../logging";
import { Stop } from "../types";
import { browser } from "../webextension";
import {
  FetchCrossOriginMessage,
  FetchCrossOriginMessageResponse,
} from "./types";

/**
 * Handle messages requesting HTTP requests without CORS enforcement.
 *
 * The sandboxed Reddit service needs to make such requests, and this is how it
 * does it.
 */
export function handleFetchCrossOriginMessages(): Stop {
  const onMessage = (
    message: any,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ): boolean => {
    let parsed;
    if ((parsed = FetchCrossOriginMessage.safeParse(message)).success) {
      executeFetchCrossOrigin(parsed.data)
        .then(sendResponse)
        .catch((e) =>
          sendResponse({
            success: false,
            error: `${e}`,
          } satisfies FetchCrossOriginMessageResponse),
        );
      // indicate we'll send an async response
      return true;
    }

    return false;
  };

  browser.runtime.onMessage.addListener(onMessage);

  return () => browser.runtime.onMessage.removeListener(onMessage);
}

export async function executeFetchCrossOrigin({
  options,
  url,
}: FetchCrossOriginMessage): Promise<FetchCrossOriginMessageResponse> {
  // note: don't log headers — they contain credentials
  log.debug("executeFetchCrossOrigin", {
    method: options.method,
    url: url,
    body: options.body,
  });

  // We only make cross-origin requests to Reddit's mobile app GraphQL API.
  if (new URL(url).origin !== "https://gql-fed.reddit.com") {
    throw new Error(`unexpected url: ${url}`);
  }

  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (e) {
    return { success: false, error: String(e) };
  }

  return {
    success: true,
    data: {
      status: response.status,
      statusText: response.statusText,
      headers: [...response.headers.entries()],
      body: await response.text(),
    },
  };
}
