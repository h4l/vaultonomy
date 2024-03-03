import { useEffect, useRef } from "react";

import { assert } from "../assert";
import { log as _log } from "../logging";

type ScrollNotchState = {
  topVisible: boolean;
  slopeVisible: boolean;
  slopeHeight: number;
};

const log = _log.getLogger("ui/ScrollNotch");
log.setLevel("warn");

/**
 * This is a notch in the page that the viewport top settles into if scrolling
 * stops with the viewport top within it.
 *
 * It's a less aggressive alternative to CSS scroll snap. (Scroll snap pulls the
 * scroll backwards to a snap point when trying to scroll away in some
 * situations, which is a horrible UX. The auto-scroll behaviour here is
 * constrained to act only in the defined region. It doesn't impede scrolling
 * past or away from the region at all, it just tidies up the scroll position
 * when close enough to a point.
 *
 * Think of the region as a V-shaped slope. If the viewport stops within the V,
 * it slides down either side of the slope to the middle (lowest point).
 *
 * We implement this using an IntersectionObserver to watch for the slope and
 * the top of the slope being on screen. When the top and the slope is visible,
 * do nothing. When only the slope is visible, we must have the browser top over
 * the slope, so if we get a scroll stop, scroll to the middle (lowerst point)
 * of the slope.
 *
 * ```
 * [==========]  top
 * [v v v v v ]  slope
 * [v v v v v ]  slope
 * [          ]  middle / lowest point
 * [^ ^ ^ ^ ^ ]  slope
 * [^ ^ ^ ^ ^ ]  slope
 * ```
 */
export function ScrollNotch({
  slopeHeight,
}: {
  slopeHeight: string;
}): JSX.Element {
  const topRef = useRef<HTMLDivElement>(null);
  const slopeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const top = topRef.current;
    const slope = slopeRef.current;
    assert(top && slope);
    const state: ScrollNotchState = {
      topVisible: false,
      slopeVisible: false,
      slopeHeight: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === top) state.topVisible = entry.isIntersecting;
        else if (entry.target === slope)
          state.slopeVisible = entry.isIntersecting;
      }

      log.debug(
        "ScrollNotch: topVisible:",
        state.topVisible,
        "slopeVisible:",
        state.slopeVisible,
      );
    });
    observer.observe(top);
    observer.observe(slope);

    const onScrollEnd = () => {
      if (state.topVisible || !state.slopeVisible) return;

      // Only the slope is visible, which means it must be intersecting the top
      // of the viewport. Slide the top of the viewport down to bottom (middle)
      // of the V-shaped slope.
      const slopeArea = slope.getBoundingClientRect();
      const pos = window.scrollY;
      const target = window.scrollY + slopeArea.top + slopeArea.height / 2;
      if (Math.abs(pos - target) < 1) {
        log.debug("ScrollNotch: scrollend at bottom of slope");
        return;
      }
      log.debug(
        "ScrollNotch: scrollend at on slope, scrolling from ",
        pos,
        " to ",
        target,
      );
      window.scrollTo({ behavior: "smooth", top: target });
    };
    document.addEventListener("scrollend", onScrollEnd);

    return () => {
      observer.unobserve(top);
      observer.unobserve(slope);
      document.removeEventListener("scrollend", onScrollEnd);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "relative",
        visibility: "hidden",
      }}
    >
      <div
        ref={slopeRef}
        style={{
          position: "absolute",
          top: `calc(${slopeHeight} / -2)`,
          height: slopeHeight,
        }}
      >
        <div ref={topRef} />
      </div>
    </div>
  );
}
