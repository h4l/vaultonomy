import { Dispatch, useContext, useEffect, useId } from "react";

import { assert } from "../../assert";
import { log } from "../../logging";
import { ProgressLinePositionRef } from "../ProgressLine";
import { Action, ProgressActionDispatchContext } from "../ProgressLine";

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

function useProgressActionDispatch(): Dispatch<Action> {
  const dispatch = useContext(ProgressActionDispatchContext);
  assert(
    dispatch !== undefined,
    "useProgressActionDispatch() used without a ProgressActionDispatchContext ancestor",
  );
  return dispatch;
}
