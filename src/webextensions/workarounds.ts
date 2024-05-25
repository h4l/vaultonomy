import { assert } from "../assert";
import { log } from "../logging";

/** Fix Firefox's content script sandbox Uint8Array instanceof checks.
 *
 * Web extension content scripts run in a sandbox to isolate them from the web
 * page they're running with. Firefox's sandbox has a bug/quirk that results in
 * this behaviour `window.Uint8Array !== globalThis.Uint8Array`. And
 * `new TextEncoder().encode('') instanceof Uint8Array` is false.
 *
 * This breaks the current version of the viem library, because it depends on
 * @noble/hashes@1.3.2 that validates Uint8Array objects with instanceof, and
 * thus breaks in the Firefox sandbox. In 1.3.3 @noble/hashes has implemented a
 * workaround that should make it compatible with the Firefox sandbox.
 *
 * For now, we can work around by changing globalThis to use the type from
 * window, which fixes the instanceof check. However this is quite a fragile
 * thing to do, because applying the fix in two separate content scripts seems
 * to result in a permission error. Luckily we only have a single content script
 * that needs to use viem.
 *
 * https://bugzilla.mozilla.org/show_bug.cgi?id=1681809
 *
 * TODO: Remove this when all dependencies use @noble/hashes >= 1.3.3.
 */
export function fixFirefoxSandboxUint8Array(): void {
  if (window.Uint8Array === globalThis.Uint8Array) return;
  log.debug("Firefox dual Uint8Array quirk detected");
  globalThis.Uint8Array = window.Uint8Array;
  assert(
    new TextEncoder().encode("") instanceof Uint8Array,
    "Failed to fix wonky content script sandbox instanceof Uint8Array behaviour",
  );
}
