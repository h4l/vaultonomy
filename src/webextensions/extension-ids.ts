import { isExtensionInstalled } from "./is-extension-installed";

// https://github.com/MetaMask/providers/blob/main/src/extension-provider/external-extension-config.json
const META_MASK_CHROME_ID = "nkbihfbeogaeaoehlefnkodbefgpgknn";
const META_MASK_FIREFOX_ID = "webextension@metamask.io";

/**
 * Get the ID of the browser's installed MetaMask extension, if any.
 *
 * @returns an extension ID if MM is installed & enabled, otherwise null.
 */
export async function getMetaMaskExtensionId(): Promise<string | null> {
  // We need to both detect if MetaMask is actually installed, and detect which
  // browser we're running in. We take the feature-detection approach (rather
  // than trying to explicitly detect Chrome vs Firefox) by checking if we can
  // communicate with either of the two possible extension IDs.
  //
  // My assumption is that it's not possible for either of the extension IDs to
  // be spoofed by an unofficial extension on either browser. Chrome randomly
  // generates IDs, and although Firefox allows IDs to be specified, it doesn't
  // allow them to follow the format used by Chrome:
  // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings#extension_id_format

  const ifInstalled = async (id: string) =>
    (await isExtensionInstalled(id)) ? id : null;

  // There's little point in short-circuiting after the first result, as
  // detecting presence takes much longer than absence, so presence would never
  // finish first in practice.
  const [chrome, firefox] = await Promise.all([
    ifInstalled(META_MASK_CHROME_ID),
    ifInstalled(META_MASK_FIREFOX_ID),
  ]);
  return chrome || firefox;
}
