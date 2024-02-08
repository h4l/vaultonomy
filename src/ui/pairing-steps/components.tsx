import { ReactNode, useEffect, useRef } from "react";
import { twMerge } from "tailwind-merge";

import { assert } from "../../assert";
import { log } from "../../logging";
import { Heading } from "../Heading";
import { usePositionReachedBroadcast } from "../ProgressLine";
import { AriaLiveAlert } from "../a11y";
import { DoneIcon, ErrorIcon, PendingIcon } from "../icons";

export type PairingStepState = "past" | "present" | "future";

export function PairingStep({
  num,
  name,
  state,
  children,
}: {
  num: number;
  name: string;
  state: PairingStepState;
  children?: ReactNode;
}): JSX.Element {
  const textTwClasses =
    state === "future" ? "text-neutral-500 dark:text-neutral-500" : undefined;
  const progressPosition = useRef<HTMLSpanElement>(null);

  usePositionReachedBroadcast({
    isReached: state !== "future",
    position: progressPosition,
  });

  return (
    <>
      <span
        ref={progressPosition}
        className={twMerge(
          "pl-2 clip-pairing-step-number",
          "mt-6 mb-2 text-4xl font-semibold justify-self-center",
          "bg-neutral-100 dark:bg-neutral-850",
          textTwClasses,
        )}
      >
        {num}.
      </span>
      <Heading level={3} className={twMerge("mt-6 mb-2", textTwClasses)}>
        {name}
      </Heading>
      {children}
    </>
  );
}

export function StepBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}): JSX.Element {
  return <div className={twMerge("col-start-2", className)}>{children}</div>;
}

const StepActionIcons = {
  done: DoneIcon,
  pending: PendingIcon,
  error: ErrorIcon,
};

export function StepAction({
  alertKey,
  state,
  headline,
  details,
}: {
  alertKey?: string;
  state: "done" | "pending" | "error";
  headline: string;
  details?: ReactNode;
}): JSX.Element {
  const progressPosition = useRef<HTMLDivElement>(null);

  // currently actions are added as they become active, so they're always reached
  usePositionReachedBroadcast({
    isReached: true,
    position: progressPosition,
  });

  const Icon = StepActionIcons[state];
  return (
    <>
      <div className="justify-self-center">
        <div
          ref={progressPosition}
          className="py-[0.125rem] bg-neutral-100 dark:bg-neutral-850"
        >
          <Icon
            size={24}
            className={
              state === "pending" ? "animate-beat text-neutral-700" : undefined
            }
          />
        </div>
      </div>
      <div>
        <p
          className={twMerge(
            "mt-1",
            state === "error" ?
              "underline underline-offset-4 decoration-wavy decoration-red-500"
            : undefined,
          )}
        >
          {headline}
          {state === "error" && alertKey && (
            <AriaLiveAlert alertId={alertKey} message={headline} />
          )}
        </p>
        {details ?
          <p>
            <small>{details}</small>
          </p>
        : undefined}
      </div>
    </>
  );
}
