import { focusManager } from "@tanstack/query-core";

function setupFocus(setFocused: (focused?: boolean) => void): () => void {
  const syncFocus = (ev: Event): void => {
    if (ev.type === "focus") setFocused(true);
    else if (ev.type === "blur") setFocused(false);
    else {
      setFocused(document.visibilityState !== "hidden");
    }
  };
  window.addEventListener("focus", syncFocus);
  window.addEventListener("blur", syncFocus);
  window.addEventListener("visibilitychange", syncFocus);
  return () => {
    window.removeEventListener("focus", syncFocus);
    window.removeEventListener("blur", syncFocus);
    window.removeEventListener("visibilitychange", syncFocus);
  };
}

/**
 * Customise Tanstack Query's focus handling to consider focus/blur events to
 * change focus, in addition to the default visibilitychange.
 *
 * The reason for this is that switching between browser windows does not trigger
 * visibilitychange (at least in Brave), only thing like switching tabs within
 * a window. So by adding focus/blur we force it to reload queries after
 * switching windows.
 *
 * See https://github.com/TanStack/query/blob/main/packages/query-core/src/focusManager.ts
 */
export function customiseTanstackQueryFocusManager() {
  focusManager.setEventListener(setupFocus);
}
