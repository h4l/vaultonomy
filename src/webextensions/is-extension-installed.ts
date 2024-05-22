import { browser } from "../webextension";

// We need to delay for a short period after creating a connection before
// Firefox will start throwing from postMessage if the connection target is not
// an installed extension. 5ms is enough to work consistently, so 20 seems like
// a decent balance between being responsive and hedging against random lag.
const PORT_CONNECT_DELAY = 20;

/**
 * Check if the browser extension with the given extensionId is installed.
 *
 * This implementation uses cross-extension messaging to probe for the
 * extension, and this can take ~20ms complete, so this should be run in the
 * background and the result cached, rather than interactively.
 */
export async function isExtensionInstalled(
  extensionId: string,
): Promise<boolean> {
  let con: chrome.runtime.Port | undefined;
  try {
    // When an extension isn't installed, Chrome throws a TypeError from
    // connect() with message "Invalid extension id: 'xxx'"
    con = browser.runtime.connect(extensionId);
    // Firefox creates a Port, but it's disconnected, so it throws Error from
    // postMessage() with message "Attempt to postMessage on disconnected port"
    // But it only throws after some delay (presumably time it takes to
    // internally fail to create a connection).
    await new Promise((resolve) => setTimeout(resolve, PORT_CONNECT_DELAY));
    con.postMessage(null);
    return true;
  } catch (e) {
    return false;
  } finally {
    if (con) con.disconnect();
  }
}
