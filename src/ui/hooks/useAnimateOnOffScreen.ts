import { RefObject, useEffect, useRef, useState } from "react";

import { assert } from "../../assert";
import { useHtmlElementHeight } from "./useHtmlElementHeight";

type TransitionState = "before-start" | "after-start" | "after-end";
type Visibility = "open" | "closed";
type Edge = "top" | "bottom";

export function useAnimateOnOffScreen({
  elRef,
  initialVisibility = "closed",
  visibility: targetVisibility,
  edge,
  openOffset = "0px",
  closedOffset = "0px",
}: {
  elRef: RefObject<HTMLElement>;
  initialVisibility?: Visibility;
  visibility: Visibility;
  edge: Edge;
  openOffset?: string;
  closedOffset?: string;
}): { height: number | undefined } {
  const [transitionState, setTransitionState] =
    useState<TransitionState>("before-start");
  const currentVisibility = useRef<Visibility>(initialVisibility);

  const height = useHtmlElementHeight(elRef);

  useEffect(() => {
    const el = elRef.current;
    assert(el);

    const onTransition = () => setTransitionState("after-end");
    el.addEventListener("transitionend", onTransition);

    return () => el.removeEventListener("transitionend", onTransition);
  }, []);

  // Transition start is under our control, triggered when
  //   targetState != currentState and currently idle.
  // We then enter transitioning state
  // transition end is triggered from transitionend event firing.

  useEffect(() => {
    const el = elRef.current;
    assert(el);

    const openTopPosition = () =>
      edge === "top" ? openOffset : (
        `calc(100% - (${height}px - ${openOffset}))`
      );
    const closedTopPosition = () =>
      edge === "top" ?
        `calc(-${height}px - ${closedOffset})`
      : `calc(100% + ${closedOffset})`;

    if (
      transitionState === "before-start" &&
      currentVisibility.current !== targetVisibility
    ) {
      // represent current position as a top offset so that we can animate with top
      const top = (
        targetVisibility === "open" ? closedTopPosition : openTopPosition)();
      el.style.top = top;
      el.style.bottom = "";
      el.style.visibility = "visible";
      setTransitionState("after-start");
    } else if (transitionState === "after-start") {
      // set transition animation target. This can flip mid-transition when toggling quickly
      const top = (
        targetVisibility === "open" ? openTopPosition : closedTopPosition)();
      el.style.top = top;
    } else {
      // set final/idle state
      el.style.visibility = targetVisibility === "open" ? "visible" : "hidden";
      if (edge === "top") {
        const top = (
          targetVisibility === "open" ? openTopPosition : closedTopPosition)();
        el.style.top = top;
        el.style.bottom = "";
      } else {
        el.style.top = "";
        el.style.bottom = openOffset;
      }
      if (transitionState === "after-end") {
        // return to idle
        currentVisibility.current = targetVisibility;
        setTransitionState("before-start");
      }
    }
  }, [transitionState, targetVisibility, height]);
  return { height };
}
