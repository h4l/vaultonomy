import { ReactNode, useEffect, useRef, useState } from "react";

import { HelpMessageProps, WithInlineHelp } from "./Help";
import { Link } from "./Link";
import { AriaLiveAlert } from "./a11y";
import { useAnimateOnOffScreen } from "./hooks/useAnimateOnOffScreen";
import { useRedditTabAvailability } from "./hooks/useRedditTabAvailability";
import { useVaultonomySettings } from "./hooks/useVaultonomySettings";
import { ErrorIcon, VaultonomyExtensionIcon } from "./icons";
import { useVaultonomyStoreSingle } from "./state/useVaultonomyStore";

type AlertType = "reddit-logged-out" | "reddit-disconnected";

/**
 * The top banner that alerts the user of error states, like Reddit not being
 * connected, or being logged out on Reddit.
 */
export function TopBanner(): JSX.Element {
  const redditTabAvailability = useRedditTabAvailability();
  const loggedOut = useVaultonomyStoreSingle((s) => s.redditWasLoggedOut);
  const [startupDelayElapsed, setStartupDelayElapsed] =
    useState<boolean>(false);
  const alertType: AlertType | null =
    !startupDelayElapsed ? null
    : !redditTabAvailability.data?.available ? "reddit-disconnected"
    : loggedOut ? "reddit-logged-out"
    : null;
  const [latestAlert, setLatestAlert] = useState(alertType);
  useEffect(() => {
    if (alertType) setLatestAlert(alertType);
  }, [alertType]);

  useEffect(() => {
    const startup = setTimeout(() => setStartupDelayElapsed(true), 500);
    return () => clearTimeout(startup);
  }, []);

  return (
    <AlertBanner active={alertType !== null}>
      {latestAlert === "reddit-disconnected" ?
        <RedditDisconnectedAlertMessage />
      : latestAlert === "reddit-logged-out" ?
        <AlertMessage
          headline="You're logged out of Reddit"
          subtitle="Go to a Reddit tab and log in"
          helpId="not-logged-in-to-reddit"
          helpText={() => (
            <>
              To use Vaultonomy, you must be logged in to your Reddit account.
              This is because Vaultonomy communicates with Reddit using the
              identity of the logged-in user.
            </>
          )}
        />
      : undefined}
    </AlertBanner>
  );
}

function RedditDisconnectedAlertMessage() {
  const redditTabAccess = useVaultonomySettings({
    select: (settings) => settings.permissions.redditTabAccess,
  });

  return (
    <AlertMessage
      headline="No connection to Reddit"
      subtitle={
        redditTabAccess.data === "activeTab" ?
          <>
            Vaultonomy's permissions are restricted. Press the{" "}
            <VaultonomyExtensionIcon className="inline w-6" /> icon on your
            browser while viewing a Reddit tab to connect.
          </>
        : "Open a Reddit tab to use Vaultonomy"
      }
      helpId="not-connected-to-reddit"
      helpText={() => (
        <>
          {redditTabAccess.data === "activeTab" ?
            // TODO tweak message for permission restrictions
            <p>
              To manage your Vault, Vaultonomy needs to connect to Reddit on
              your behalf using a Reddit tab.{" "}
              <b>
                Vaultonomy's automatic access to Reddit has been turned off in
                your browser extension settings.
              </b>{" "}
              To give Vaultonomy one-time access, open a Reddit tab and click
              Vaultonomy's extension icon.{" "}
              <VaultonomyExtensionIcon className="inline w-7" />
            </p>
          : <p>
              To manage your Vault, Vaultonomy needs to connect to Reddit on
              your behalf using a Reddit tab. You don't have any Reddit tabs
              open;{" "}
              <Link href="https://www.reddit.com/">open a Reddit tab</Link> to
              use Vaultonomy.
            </p>
          }
        </>
      )}
    />
  );
}

function AlertMessage({
  headline,
  subtitle,
  ...help
}: {
  headline: string;
  subtitle: ReactNode;
} & HelpMessageProps): JSX.Element {
  const helpId = help?.helpId ?? help.helpText;

  return (
    <>
      <WithInlineHelp
        iconOffsetTop="-0.75rem"
        iconOffsetLeft="0.3rem"
        {...help}
      >
        <h2
          className={[
            "relative mt-12 text-2xl font-bold",
            "underline underline-offset-[0.4rem] decoration-wavy decoration-red-500",
          ].join(" ")}
        >
          <ErrorIcon className="absolute -left-12 inline-block" /> {headline}
        </h2>
      </WithInlineHelp>
      <p className="text-lg mt-2">{subtitle}</p>
      <AriaLiveAlert alertId={helpId} message={headline} />
    </>
  );
}

export function AlertBanner({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useAnimateOnOffScreen({
    elRef: ref,
    initialVisibility: active ? "open" : "closed",
    visibility: active ? "open" : "closed",
    edge: "top",
    openOffset: "-2rem",
    closedOffset: "4rem",
  });

  return (
    <>
      <div
        ref={ref}
        className={[
          "invisible transition-[top] duration-500",
          "fixed z-20 _-top-8 -inset-x-8 px-12 py-4 -rotate-1",
          "bg-gradient-to-t via-25% from-neutral-25 to-neutral-100",
          "dark:from-neutral-800 dark:to-neutral-875",
          "shadow-2xl dark:shadow-2xl-heavy",
        ].join(" ")}
      >
        <div className="border-b border-neutral-200 dark:border-neutral-750 p-4 flex flex-row justify-center">
          <div className="max-w-prose mb-4 pl-12">{children}</div>
        </div>
      </div>
    </>
  );
}
