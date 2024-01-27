import { useEffect, useRef, useState } from "react";

type ExpandCollapseState = {
  expansion: "expanded" | "collapsed";
  transition: "idle" | "transitioning";
};
export type UseExpandCollapseElementResult = {
  state: ExpandCollapseState;
  isExpanded: boolean;
  isTransitioning: boolean;
  changeSize: (state: "expanded" | "collapsed") => void;
  toggleExpansion: () => void;
  transitionEnd: () => void;
};

export function useExpandCollapseElement({
  el,
  initiallyExpanded,
}: {
  el: HTMLElement | null;
  initiallyExpanded?: boolean;
}): UseExpandCollapseElementResult {
  const [targetState, setTargetState] = useState<ExpandCollapseState>({
    expansion: initiallyExpanded ?? true ? "expanded" : "collapsed",
    transition: "idle",
  });
  const currentState = useRef<ExpandCollapseState | null>();

  useEffect(() => {
    if (!el) return;
    let deferredSetHeight: number | undefined;
    if (targetState.expansion === "expanded") {
      if (targetState.transition === "transitioning") {
        el.style["height"] = `${el.scrollHeight}px`;
      } else {
        el.style["height"] = "auto";
      }
    } else {
      if (targetState.transition === "transitioning") {
        if (currentState.current?.transition === "idle") {
          // Need to set an explicit size to animate a height transition
          el.style["height"] = `${el.scrollHeight}px`;
        }
        deferredSetHeight = requestAnimationFrame(() => {
          el.style["height"] = "0px";
          deferredSetHeight = undefined;
        });
      } else {
        el.style["height"] = "0px";
      }
    }
    currentState.current = { ...targetState };
    return () => {
      if (deferredSetHeight !== undefined) {
        cancelAnimationFrame(deferredSetHeight);
      }
    };
  }, [el, targetState]);

  const changeSize = (expansion: ExpandCollapseState["expansion"]) => {
    setTargetState({ transition: "transitioning", expansion });
  };
  return {
    state: { ...targetState },
    isExpanded: targetState.expansion === "expanded",
    isTransitioning: targetState.transition === "transitioning",
    changeSize,
    toggleExpansion: () => {
      changeSize(
        targetState.expansion === "expanded" ? "collapsed" : "expanded",
      );
    },
    transitionEnd: () => {
      setTargetState({ ...targetState, transition: "idle" });
    },
  };
}
