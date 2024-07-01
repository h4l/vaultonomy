import { assert } from "../../assert";
import { log as _log } from "../../logging";
import type { UserLinkInteractionEvent } from "../../messaging";
import { Stop, Unbind } from "../../types";
import { browser } from "../../webextension";

const interestInUserEvent = "vaultonomy:interest-in-user";
type InterestInUser = {
  interest: "interested" | "disinterested";
  dwellTime: number;
  username: string;
  startTime: number;
};
const userUrlPattern =
  /^https:\/\/(?:www|new|old)\.reddit\.com\/u(?:ser)?\/([\w-]{1,20})\/?$/;

const log = _log.getLogger("reddit/ui");
const hoverLog = _log.getLogger(
  "reddit/ui/detectInterestInUserFromUserLinkInteraction",
);

/**
 * Detect when the user hovers over a link to another Reddit user so that we can
 * have the Vaultonomy UI automatically show details of the user in the search
 * area.
 */
export default function main(): Unbind {
  log.debug("starting");

  const toStop: Stop[] = [];

  const shutdown = () => {
    for (const stop of toStop) stop();
    log.debug("stopped");
  };

  toStop.push(detectInterestInUserFromUserLinkInteraction());
  toStop.push(reportInterestInUser({ shutdown }));

  return shutdown;
}

function isInterestInUser(obj: unknown): obj is InterestInUser {
  return (
    typeof obj === "object" &&
    !!(obj as Partial<InterestInUser>).username &&
    !!(obj as Partial<InterestInUser>).startTime
  );
}

function reportInterestInUser({ shutdown }: { shutdown: Stop }): Unbind {
  const onInterestInUser = (e: Event) => {
    const detail = (e as CustomEvent<unknown>).detail;
    assert(isInterestInUser(detail));

    try {
      browser.runtime.sendMessage({
        type: "userLinkInteraction",
        interest: detail.interest,
        username: detail.username,
        startTime: detail.startTime,
        dwellTime: detail.dwellTime,
      } satisfies UserLinkInteractionEvent);
      log.debug(
        "Reported interest in user ",
        detail.username,
        "for",
        detail.dwellTime,
        "ms",
      );
    } catch (error) {
      if (String(error).includes("Extension context invalidated")) {
        log.debug("Stopping due to extension context invalidation");
        shutdown();
        return;
      }
      throw error;
    }
  };

  window.addEventListener(interestInUserEvent, onInterestInUser);

  return () =>
    window.removeEventListener(interestInUserEvent, onInterestInUser);
}

type UserLink = {
  startTime: number;
  el: HTMLAnchorElement;
  username: string;
  stop?: (reason: "blur" | "shutdown") => void;
  stopped: boolean;
};

function detectInterestInUserFromUserLinkInteraction({
  updateInterval = 100,
  updateCount = 5,
}: {
  updateInterval?: number;
  updateCount?: number;
} = {}): Unbind {
  let currentUserLink: UserLink | undefined;

  function onMouseOver(e: Event): void {
    if (!(e.target instanceof HTMLElement)) return;
    const containingAnchor = e.target.closest("a[href]");
    if (!(containingAnchor instanceof HTMLAnchorElement)) return;

    // Entered a new element within an anchor — ignore
    if (!currentUserLink?.stopped && containingAnchor === currentUserLink?.el)
      return;

    const userUrl = userUrlPattern.exec(containingAnchor.href);
    if (!userUrl) return;
    const username = userUrl[1];

    if (currentUserLink) currentUserLink.stop && currentUserLink.stop("blur");
    const state: UserLink = (currentUserLink = {
      startTime: Date.now(),
      el: containingAnchor,
      username,
      stopped: false,
    });

    hoverLog.debug("mouse entered link to", username);

    let timer: NodeJS.Timeout | undefined = undefined;
    let currentUpdateCount = 0;
    const notifyInterested = () => {
      const dwellTime = Date.now() - state.startTime;
      hoverLog.debug(
        "mouse remained within link to",
        username,
        "for",
        dwellTime,
        "ms",
      );
      window.dispatchEvent(
        new CustomEvent<InterestInUser>(interestInUserEvent, {
          detail: {
            interest: "interested",
            username,
            startTime: state.startTime,
            dwellTime: Date.now() - state.startTime,
          },
        }),
      );
      currentUpdateCount++;
      if (currentUpdateCount >= updateCount) clearInterval(timer);
    };
    // The mouse must remain within the element for a minimum duration.
    // Confirm interest after this duration.
    timer = setInterval(notifyInterested, updateInterval);

    // Cancel without indicating interest if the mouse leaves before the min duration.
    // TODO: should we debounce leaves?
    const onLeaveAnchor = () => {
      state.stop!("blur");
      hoverLog.debug(
        "mouse left link to",
        username,
        `after ${Date.now() - state.startTime}ms, ${currentUpdateCount} ${updateInterval}ms interest intervals`,
      );
    };
    containingAnchor.addEventListener("mouseleave", onLeaveAnchor);

    state.stop = (reason: "blur" | "shutdown") => {
      state.stopped = true;
      clearInterval(timer);
      containingAnchor.removeEventListener("mouseleave", onLeaveAnchor);
      if (currentUpdateCount > 0 && reason !== "shutdown") {
        window.dispatchEvent(
          new CustomEvent<InterestInUser>(interestInUserEvent, {
            detail: {
              interest: "disinterested",
              username,
              startTime: state.startTime,
              dwellTime: Date.now() - state.startTime,
            },
          }),
        );
      }
    };
  }
  document.addEventListener("mouseover", onMouseOver);

  return () => {
    document.removeEventListener("mouseover", onMouseOver);
    if (currentUserLink?.stop) currentUserLink.stop("shutdown");
  };
}
