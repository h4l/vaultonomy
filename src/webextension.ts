// Use @types/chrome for the WebExtension API (rather than
// webextension-polyfill) as they're more accurate and we only want to use
// APIs that exist in Chrome.
interface WebExtensionGlobal {
  chrome?: typeof chrome;
  browser?: typeof chrome;
}

const webExtensionGlobal = globalThis as WebExtensionGlobal;
const _browser = webExtensionGlobal.browser ?? webExtensionGlobal.chrome;
if (!_browser) {
  throw new Error(
    "WebExtension API not found on browser or chrome properties of globalThis",
  );
}
export const browser: typeof chrome = _browser;
