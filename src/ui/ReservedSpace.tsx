import { useEffect, useRef, useState } from "react";

import { assert } from "../assert";

/**
 * A vertical spacer that expands when a viewport-fixed footer is active, to
 * allow the page content to scroll above the fixed footer.
 *
 * When the footer is closed, the space remains until the viewport scrolls away,
 * so that the viewport doesn't jump as the footer closes. It also transitions
 * height in an out, so that scroll bars don't jump.
 */
export function ReservedSpace({
  required,
  height,
}: {
  required: boolean;
  height: number;
}): JSX.Element {
  const elRef = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(false);
  const [finishedShrinking, setFinishedShrinking] = useState(true);
  const isVisible = required || onScreen || !finishedShrinking;

  // Track whether the space under fixed footer (to allow scrolling to the bottom)
  // is on screen, so that we don't cause a jump by removing it when visible.
  useEffect(() => {
    const el = elRef.current;
    assert(el);
    const observer = new IntersectionObserver((entries) => {
      assert(entries.length === 1);
      assert(entries[0].target === el);
      setOnScreen(entries[0].isIntersecting);
    });
    observer.observe(el);

    return () => observer.unobserve(el);
  }, []);

  useEffect(() => {
    if (required && onScreen) setFinishedShrinking(false);
  }, [required, onScreen]);

  return (
    <div
      ref={elRef}
      className="h-0 transition-[height] duration-1000"
      onTransitionEnd={() => {
        if (!onScreen) setFinishedShrinking(true);
      }}
      style={{
        display: isVisible ? undefined : "none",
        height:
          isVisible ?
            required || onScreen ?
              `${height}px`
            : "0px"
          : undefined,
      }}
    />
  );
}
