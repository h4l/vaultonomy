import { browser } from "../webextension";
import { VAULTONOMY_DEV_EXTENSION_ID } from "./constants";

/**
 * Create a Port connected to Vaultonomy's dev-mode extension from a web page.
 *
 * This is used by the dev-mode Vaultonomy UI (served from the dev-server via
 * HTTP) to connect to the Vaultonomy extension, itself running in unpacked dev
 * mode
 *
 * By default, web pages can't connect to extensions, so this requires a few
 * things to work:
 *
 * 1. The web page calling this must be served from http://vaultonomy.localhost:5173
 *    The Vaultonomy manifest.json (in dev-mode only) lists this origin as
 *    externally_connectable, which gives it permission it to connect.
 * 2. The dynamic dev-mode extension ID. Unlike the published extension, the
 *    unpacked extension has a different ID for each install, so it must be
 *    configured. See the definition of VAULTONOMY_DEV_EXTENSION_ID.
 *
 * The connections created here fire the chrome.runtime.onConnectExternal event,
 * not the regular chrome.runtime.onConnect event.
 */
export function createVaultonomyPortFromOutsideExtension({
  name,
}: {
  name: string;
}): chrome.runtime.Port {
  if (typeof browser?.runtime?.connect !== "function") {
    throw new Error(
      `createVaultonomyPortFromOutsideExtension: browser.runtime.connect is \
not a function — is this page\'s origin listed as externally_connectable in \
the manifest of extension ID ${JSON.stringify(VAULTONOMY_DEV_EXTENSION_ID)}?`,
    );
  }
  // Although we're in a regular web page, the browser injects the extension API
  // to create Port connections when the page's URL matches the extension's
  // externally_connectable rules, so we can use browser.runtime.connect.
  return browser.runtime.connect(VAULTONOMY_DEV_EXTENSION_ID, {
    name: name,
  });
}
