import { useEffect, useRef, useState } from "react";

import { assert } from "../assert";

function useWindowWidth(): number {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const listener = () => {
      setWidth(window.innerWidth);
    };
    addEventListener("resize", listener);
    return () => removeEventListener("resize", listener);
  }, []);
  return width;
}

export function HelpModal({
  initialState,
}: {
  initialState: "closed" | "open";
}): JSX.Element {
  const reservedSpace = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLElement>(null);
  const [reservedSpaceOnScreen, setReservedSpaceOnScreen] = useState(false);
  const [modalHeight, setModalHeight] = useState(0);
  const [state, setState] = useState(initialState);
  const [transitionState, setTransitionState] = useState<
    "at-end" | "at-start" | "started"
  >("at-end");
  const windowWidth = useWindowWidth();
  const backgroundClasses = state === "closed" ? "" : "";

  // Track whether the space under fixed footer (to allow scrolling to the bottom)
  // is on screen, so that we don't cause a jump by removing it when visible.
  useEffect(() => {
    if (!reservedSpace.current) {
      setReservedSpaceOnScreen(false);
      return;
    }

    const el = reservedSpace.current;
    const observer = new IntersectionObserver((entries) => {
      assert(entries.length === 1);
      assert(entries[0].target === el);
      setReservedSpaceOnScreen(entries[0].isIntersecting);
    });
    observer.observe(el);
    return () => observer.unobserve(el);
  }, [reservedSpace]);

  // TODO: include dynamic content as a dependency
  useEffect(() => {
    setModalHeight(ref.current?.offsetHeight ?? 0);
  }, [ref, windowWidth]); // include width as a dependency to recalculate on resize

  // Apply styles for the slide in/out CSS transitions. For the transitions to
  // animate correctly, these need to be applied as side-effects to ensure the
  // starting values are set before the ending values are.
  useEffect(() => {
    assert(ref.current);

    // Position from the top when closed and bottom when open so that changes to
    // screen width that affect element height cause it to remain entirely
    // off/on screen when closed/open.
    if (transitionState === "at-start") {
      if (state === "closed") {
        ref.current.style.top = `calc(100vh - ${ref.current.offsetHeight}px)`;
        ref.current.style.bottom = "";
      } else {
        ref.current.style.top = "";
        ref.current.style.bottom = `-${ref.current.offsetHeight}px`;
      }
      setTransitionState("started");
    } else {
      if (state === "closed") {
        ref.current.style.top = "100vh";
        ref.current.style.bottom = "";
      } else {
        ref.current.style.top = "";
        ref.current.style.bottom = "0px";
      }
    }
  }, [state, transitionState, modalHeight]);

  return (
    <div
      ref={reservedSpace}
      className="h-0"
      style={{
        height:
          state === "open" || reservedSpaceOnScreen
            ? `${modalHeight}px`
            : undefined,
      }}
    >
      <aside
        ref={ref}
        aria-label="help"
        className={`fixed w-full left-0 min-h-[5rem] p-4 flex flex-row justify-center
                  border-t border-dashed border-neutral-400 bg-white dark:bg-neutral-950
                  transition-[top,bottom] ${backgroundClasses}`}
        onTransitionEnd={() => setTransitionState("at-end")}
      >
        <button
          className="fixed left-0 bottom-0 drop-shadow
                   "
          onClick={() => {
            setState(state === "closed" ? "open" : "closed");
            setTransitionState("at-start");
          }}
        >
          <div
            className={`p-4 clip-circle-35 bg-green-700 transition-all ${
              state === "open" ? "text-neutral-100" : "bg-transparent"
            }`}
          >
            <HelpIconLarge />
          </div>
        </button>
        <div className="max-w-prose flex flex-col justify-center">
          <p>The primary ENS (Ethereum Name Service) name of this address.</p>
        </div>
      </aside>
    </div>
  );
}

function HelpIconLarge({
  className,
  size,
}: {
  size?: number | string;
  className?: string;
}): JSX.Element {
  size = size ?? 48;
  return (
    // https://fonts.google.com/icons?selected=Material+Symbols+Outlined:help:FILL@0;wght@400;GRAD@0;opsz@48&icon.query=help
    <svg
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      width={size}
    >
      <title>Help</title>
      <path
        fill="currentColor"
        d="M484-247q16 0 27-11t11-27q0-16-11-27t-27-11q-16 0-27 11t-11 27q0 16 11 27t27 11Zm-35-146h59q0-26 6.5-47.5T555-490q31-26 44-51t13-55q0-53-34.5-85T486-713q-49 0-86.5 24.5T345-621l53 20q11-28 33-43.5t52-15.5q34 0 55 18.5t21 47.5q0 22-13 41.5T508-512q-30 26-44.5 51.5T449-393Zm31 313q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 31.5-156t86-127Q252-817 325-848.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 82-31.5 155T763-197.5q-54 54.5-127 86T480-80Zm0-60q142 0 241-99.5T820-480q0-142-99-241t-241-99q-141 0-240.5 99T140-480q0 141 99.5 240.5T480-140Zm0-340Z"
      />
    </svg>
  );
}
