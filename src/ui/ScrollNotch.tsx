import debounce from "lodash.debounce";
import { useEffect, useRef } from "react";

import { assert } from "../assert";
import { log as _log } from "../logging";

type ScrollNotchState = {
  topVisible: boolean;
  slopeVisible: boolean;
  slopeHeight: number;
};

const log = _log.getLogger("ui/ScrollNotch");

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

    let lastManualScrollTime = 0;
    const detectManualScroll = (ev: KeyboardEvent | Event) => {
      if (
        ev.type === "wheel" ||
        (ev.type === "keydown" &&
          "PageDown PageUp ArrowUp ArrowDown".includes(
            (ev as KeyboardEvent).code,
          ))
      ) {
        // only record manual scrolls within the slope
        if (state.topVisible || !state.slopeVisible) return;
        lastManualScrollTime = Date.now();
      }
    };
    document.addEventListener("keydown", detectManualScroll);
    document.addEventListener("wheel", detectManualScroll);

    // We want to avoid fighting the user if they scroll manually as we
    // auto-scroll to the low point. Our strategy to achieve this is first to
    // debounce (delay and aggregate) all auto-scrolls until 500ms after the
    // most-recent scroll end. This makes the auto scroll feel less assertive.
    // Second, we delay auto-scrolls until at ~500ms after the most-recent
    // manual keyboard or mouse scroll.
    //
    // In principle we could shorten overall debounce and keep the manual-scroll
    // delay higher, but browsers report wheel events throughout inertial smooth
    // scrolls, so there's generally been a "manual" scroll within 500ms when
    // scrolling into the region. (An exception is if you do a page up/down into
    // the region.) The result is that the manual scroll delay is
    const onScrollEnd = debounce(
      () => {
        if (state.topVisible || !state.slopeVisible) return;

        // retry the auto-scroll later if we just saw a manual scroll
        if (Date.now() - lastManualScrollTime < 490) {
          log.debug("debouncing scrollend close to manual scroll");
          onScrollEnd();
          return;
        }

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
      },
      510,
      { leading: false, trailing: true },
    );
    document.addEventListener("scrollend", onScrollEnd);

    return () => {
      observer.unobserve(top);
      observer.unobserve(slope);
      document.removeEventListener("keydown", detectManualScroll);
      document.removeEventListener("wheel", detectManualScroll);
      document.removeEventListener("scrollend", onScrollEnd);
      onScrollEnd.cancel();
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
