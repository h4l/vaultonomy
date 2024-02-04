import {
  Dispatch,
  ReactNode,
  RefObject,
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
} from "react";

import { assert, assertUnreachable } from "../assert";
import { log } from "../logging";

type ProgressLinePosition = HTMLElement | "end";
type ProgressLinePositionRef = RefObject<HTMLElement> | "end";
type ProgressLinePositions = {
  positionStates: ProgressLinePositionStates;
  reachedPosition: ProgressLinePosition | null;
};
type ProgressLinePositionStates = Record<
  string,
  { reached: boolean; position: ProgressLinePosition }
>;

const ProgressReachedPositionContext = createContext<
  ProgressLinePosition | null | undefined
>(undefined);
const ProgressActionDispatchContext = createContext<
  Dispatch<Action> | undefined
>(undefined);

type Action =
  | {
      type: "position-changed";
      id: string;
      position: ProgressLinePosition;
      reached: boolean;
    }
  | { type: "position-removed"; id: string };

function reducer(
  state: ProgressLinePositions,
  action: Action,
): ProgressLinePositions {
  let positionStates = state.positionStates;
  switch (action.type) {
    case "position-changed":
      if (
        positionStates[action.id]?.position === action.position &&
        positionStates[action.id]?.reached === action.reached
      ) {
        return state;
      }

      positionStates = {
        ...positionStates,
        [action.id]: { position: action.position, reached: action.reached },
      };
      break;
    case "position-removed":
      if (positionStates[action.id] === undefined) return state;

      positionStates = { ...positionStates };
      delete positionStates[action.id];
      break;
    default:
      assertUnreachable(action);
  }
  return {
    positionStates,
    reachedPosition: furthestReachedPosition(positionStates),
  };
}

export function ProgressLineContainer({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [{ reachedPosition }, dispatch] = useReducer(reducer, {
    positionStates: {},
    reachedPosition: null,
  });

  return (
    <ProgressReachedPositionContext.Provider value={reachedPosition}>
      <ProgressActionDispatchContext.Provider value={dispatch}>
        {children}
      </ProgressActionDispatchContext.Provider>
    </ProgressReachedPositionContext.Provider>
  );
}

/** Get the furthest ahead of two elements by document order. */
function lastElement<T extends Node>(a: T, b: T): T {
  const aCmpB = a.compareDocumentPosition(b);
  // Rarely, a node can be disconnected from the DOM before we handle it.
  // Probably only happens when paused in the debugger in practice.
  if (aCmpB & Node.DOCUMENT_POSITION_DISCONNECTED) return !a.parentNode ? b : a;
  return aCmpB & Node.DOCUMENT_POSITION_FOLLOWING ? b : a;
}

function furthestReachedPosition(
  positionStates: ProgressLinePositionStates,
): HTMLElement | "end" | null {
  return Object.values(positionStates).reduce(
    (prev: HTMLElement | "end" | null, curr): HTMLElement | "end" | null => {
      if (!curr.reached) return prev;
      if (prev === "end" || curr.position === "end") return "end";
      if (prev === null) return curr.position;
      return lastElement(prev, curr.position);
    },
    null,
  );
}

function useFurthestPositionReached(): ProgressLinePosition | null {
  const position = useContext(ProgressReachedPositionContext);
  assert(
    position !== undefined,
    "useFurthestPositionReached() used without a ProgressReachedPositionContext ancestor",
  );
  return position;
}

function useProgressActionDispatch(): Dispatch<Action> {
  const dispatch = useContext(ProgressActionDispatchContext);
  assert(
    dispatch !== undefined,
    "useProgressActionDispatch() used without a ProgressActionDispatchContext ancestor",
  );
  return dispatch;
}

/**
 * Use the CSS height value for `progressBar` corresponding to the middle of
 * `position`, assuming both are descendants of `container`.
 */
function usePositionYHeight({
  container,
  progressBar,
  position,
}: {
  container: HTMLElement | null;
  progressBar: HTMLElement | null;
  position: ProgressLinePosition | null;
}): string | null {
  const [containerSizeKey, setContainerSizeKey] = useState<string | null>(null);
  const [positionYHeight, setPositionYHeight] = useState<string | null>(null);
  useEffect(() => {
    if (!container) {
      setContainerSizeKey(null);
      return;
    }

    const resize = new ResizeObserver((resizes) => {
      assert(resizes.length === 1);
      const [{ target, contentBoxSize }] = resizes;
      assert(target === container);
      assert(contentBoxSize.length > 0);

      const width = contentBoxSize[0].inlineSize;
      const height = contentBoxSize[0].blockSize;
      setContainerSizeKey(`${width}x${height}`);
    });
    resize.observe(container);

    return () => {
      resize.unobserve(container);
    };
  }, [container]);

  // The positions should move vertically either when the container width
  // resizes, or when other steps above it resize. In the second case, the
  // container height should also change, so just monitoring the container size
  // should work.
  useEffect(() => {
    if (!progressBar || !position) {
      setContainerSizeKey(null);
      return;
    }
    if (position === "end") {
      setPositionYHeight("100%");
      return;
    }

    const progressBarTop = progressBar.getBoundingClientRect().top;
    const positionArea = position.getBoundingClientRect();
    const height = positionArea.top - progressBarTop + positionArea.height / 2;
    setPositionYHeight(`${height}px`);
  }, [progressBar, containerSizeKey, position]);

  return positionYHeight;
}

export function PositionProgressLine(): JSX.Element {
  const positionReached = useFurthestPositionReached();
  const progressEl = useRef<HTMLDivElement>(null);
  const progressPosition = usePositionYHeight({
    container: progressEl.current ? progressEl.current.parentElement : null,
    progressBar: progressEl.current,
    position: positionReached,
  });

  return <ProgressLine ref={progressEl} progressPosition={progressPosition} />;
}

type ProgressLineProps = { progressPosition: string | null };
const ProgressLine = forwardRef<HTMLDivElement, ProgressLineProps>(
  ({ progressPosition }, ref): JSX.Element => {
    return (
      <>
        <div
          className={[
            "absolute z-0 left-4 h-full border-r",
            "border-neutral-500 dark:border-neutral-500",
          ].join(" ")}
        />
        <div
          ref={ref}
          style={{
            transitionProperty: "height",
            height: progressPosition ?? "0%",
          }}
          className={[
            "absolute z-0 left-4 border-r-2 border-l",
            "border-neutral-800 dark:border-neutral-200",
            "duration-1000 ease-in-out",
          ].join(" ")}
        />
      </>
    );
  },
);

/**
 * Report whether a progress line position has been reached.
 *
 * The container's progress line will consider this position when determining
 * how far down the line should be drawn.
 */
export function usePositionReachedBroadcast({
  isReached,
  position,
}: {
  isReached: boolean;
  position: ProgressLinePositionRef | null;
}): void {
  const dispatch = useProgressActionDispatch();
  const id = useId();

  // Always create and remove the position on mount/unmount
  useEffect(() => {
    const pos = position === "end" ? position : position?.current;
    assert(pos, "position is null on component mount");
    dispatch({
      type: "position-changed",
      id,
      position: pos,
      reached: isReached,
    });

    return () => dispatch({ id, type: "position-removed" });
  }, []);

  // Also update the position when isReached changes
  useEffect(() => {
    const pos = position === "end" ? position : position?.current;
    if (!pos) return;
    if (pos !== "end" && !pos.parentNode) {
      log.debug(
        "usePositionReachedBroadcast not broadcasting disconnected pos:",
        pos,
        "id:",
        id,
      );
      return;
    }

    dispatch({
      id,
      type: "position-changed",
      position: pos,
      reached: isReached,
    });
    return () => {};
  }, [dispatch, id, isReached, position]);
}
