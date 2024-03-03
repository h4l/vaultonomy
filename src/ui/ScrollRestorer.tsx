import { RefObject, useEffect, useRef, useState } from "react";

import { assert } from "../assert";
import { log as _log } from "../logging";
import {
  useVaultonomyStore,
  useVaultonomyStoreSingle,
} from "./state/useVaultonomyStore";

const log = _log.getLogger("ui/ScrollRestorer");
log.setLevel("warn");

/**
 * Save the last scroll position to the store, and restore it upon startup.
 *
 * Restoration is needed because web extensions forget their scroll position
 * when re-opening a sidebar/popup window.
 *
 * We also use this to make the default page start position the main Vaultonomy
 * heading logo area, as we treat the user search part above the header like an
 * alternative secondary page. (We have two scroll directions, why do we only
 * use one of them most of the time?)
 */
export function ScrollRestorer({
  defaultStart,
}: {
  defaultStart: RefObject<HTMLElement>;
}): JSX.Element {
  const [hasRestored, setHasRestored] = useState(false);
  const setLastScrollPosition = useVaultonomyStoreSingle(
    (s) => s.setLastScrollPosition,
  );

  useEffect(() => {
    history.scrollRestoration = "manual";

    const onScrollEnd = () => setLastScrollPosition(window.scrollY);
    document.addEventListener("scrollend", onScrollEnd);
    return () => document.removeEventListener("scrollend", onScrollEnd);
  }, []);

  // We restore the position in a subcomponent so that we can stop watching the
  // lastScrollPosition store value after restoring, otherwise we'd re-render
  // every scrollend.
  return hasRestored ?
      <></>
    : <SetInitialScrollPosition
        defaultStart={defaultStart}
        onPositionSet={() => setHasRestored(true)}
      />;
}
/**
 * Restore or set the default scroll position when the prev position is known
 * when the store hydrates.
 */
function SetInitialScrollPosition({
  onPositionSet,
  defaultStart,
}: {
  onPositionSet: () => void;
  defaultStart: RefObject<HTMLElement>;
}): JSX.Element {
  const [hasHydrated, lastScrollPosition] = useVaultonomyStore((s) => [
    s.hasHydrated,
    s.lastScrollPosition,
  ]);
  const hasRestored = useRef(false);

  useEffect(() => {
    if (hasRestored.current) return;
    if (!hasHydrated) return;
    hasRestored.current = true;
    onPositionSet();
    assert(defaultStart.current);
    const target =
      lastScrollPosition ??
      window.scrollY + defaultStart.current?.getBoundingClientRect().top;
    window.scrollTo({ behavior: "instant", top: target });
    log.debug(
      "position restored to ",
      lastScrollPosition === null ? "default" : "saved",
      "position",
      target,
    );
  }, [defaultStart, hasHydrated, lastScrollPosition]);

  return <></>;
}
