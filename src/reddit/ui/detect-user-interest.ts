import { assert } from "../../assert";
import { log as _log } from "../../logging";
import type { InterestInUserEvent } from "../../messaging";
import { Stop, Unbind } from "../../types";
import { browser } from "../../webextension";

const interestInUserEvent = "vaultonomy:interest-in-user";
type InterestInUser = { username: string; startTime: number };
const userUrlPattern =
  /^https:\/\/(?:www|new)\.reddit\.com\/u(?:ser)?\/([\w-]{1,20})\/?$/;

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
        type: "redditUserShowedInterestInUser",
        username: detail.username,
        startTime: detail.startTime,
        trigger: "user-link-hover",
      } satisfies InterestInUserEvent);
      log.debug("Reported interest in user", detail.username);
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
  stop?: Unbind;
  stopped: boolean;
};

function detectInterestInUserFromUserLinkInteraction({
  hoverInterestTime = 500,
}: {
  hoverInterestTime?: number;
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

    if (currentUserLink) currentUserLink.stop && currentUserLink.stop();
    const state: UserLink = (currentUserLink = {
      startTime: Date.now(),
      el: containingAnchor,
      username,
      stopped: false,
    });

    hoverLog.debug("mouse entered link to", username);

    let timeout: NodeJS.Timeout | undefined = undefined;
    const confirmInterest = () => {
      hoverLog.debug("mouse remained within link to", username);
      state.stop!();
      window.dispatchEvent(
        new CustomEvent<InterestInUser>(interestInUserEvent, {
          detail: { username, startTime: state.startTime },
        }),
      );
    };
    // The mouse must remain within the element for a minimum duration.
    // Confirm interest after this duration.
    timeout = setTimeout(confirmInterest, hoverInterestTime);

    // Cancel without indicating interest if the mouse leaves before the min duration.
    const onLeaveAnchor = () => {
      state.stop!();
      hoverLog.debug(
        "mouse left link to",
        username,
        "before min duration elapsed",
      );
    };
    containingAnchor.addEventListener("mouseleave", onLeaveAnchor);

    state.stop = () => {
      state.stopped = true;
      clearTimeout(timeout);
      containingAnchor.removeEventListener("mouseleave", onLeaveAnchor);
    };
  }
  document.addEventListener("mouseover", onMouseOver);

  return () => {
    document.removeEventListener("mouseover", onMouseOver);
    if (currentUserLink?.stop) currentUserLink.stop();
  };
}
