import { browser } from "../webextension";

// Connecting to an extension ID that is not installed fails quickly, but
// asynchronously. Usually in a 2-3ms, but I've seen 20 once when testing.
// If we don't get an error within this time we consider the port to be
// connected, and therefore the extension is installed.
// This value needs to be reasonably small, as when the extension is installed,
// the promise can hang for arbitrary durations, and a user will always need to
// wait this duration.
const PORT_CONNECT_ERROR_TIMEOUT = 100;

/**
 * Check if the browser extension with the given extensionId is installed.
 *
 * This implementation uses cross-extension messaging to probe for the
 * extension, and this can take ~100ms to complete, so this should be run in the
 * background and the result cached, rather than interactively.
 */
export async function isExtensionInstalled(
  extensionId: string,
): Promise<boolean> {
  try {
    // sendMessage can block for long periods of time, e.g. Chrome seems to not
    // wake up the receiving extension if it's not already active.
    await Promise.race([
      browser.runtime.sendMessage(extensionId, null),
      new Promise((resolve) =>
        setTimeout(() => resolve(undefined), PORT_CONNECT_ERROR_TIMEOUT),
      ),
    ]);
    // We got no error within the timeout — presume connection succeeded and
    // therefore extension is installed.
    return true;
  } catch (e) {
    // When messaging an extension ID that's not installed, Chrome rejects with:
    // > Could not establish connection. Receiving end does not exist.
    return false;
  }
}
