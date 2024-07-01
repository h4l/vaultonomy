import { twMerge } from "tailwind-merge";

import { AnyRedditUserProfile } from "../reddit/types";
import { WithInlineHelp } from "./Help";
import { Link } from "./Link";
import { UserAvatar } from "./UserAvatar";
import { BlockIcon } from "./icons";
import { pxNumbersAsRem } from "./utils/units";

export function UserProfile({
  label = "Your",
  profile: anyProfile,
  fixedHeight = false,
}: {
  label?: string;
  profile?: AnyRedditUserProfile;
  fixedHeight?: boolean;
}): JSX.Element {
  const profile = anyProfile?.isSuspended ? undefined : anyProfile;
  return (
    <section
      id={`${label.toLowerCase()}-account`}
      aria-label={`${label} Reddit account details`}
      className="flex flex-col items-center"
    >
      <span aria-label="status" className="sr-only">
        {anyProfile === undefined ?
          "Disconnected from Reddit"
        : "Connected to Reddit"}
      </span>
      <WithInlineHelp
        iconOffsetLeft="0.5rem"
        iconOffsetBottom="3.875rem"
        helpText={`${label} Reddit account's avatar.`}
      >
        {profile ?
          <Link
            href={`https://www.reddit.com/user/${encodeURIComponent(profile.username)}`}
          >
            <UserAvatar
              title={`${profile.username}'s Reddit Profile`}
              className="w-40"
              avatarUrl={profile.accountIconFullBodyURL ?? undefined}
              fixedHeight={fixedHeight}
            />
          </Link>
        : <UserAvatar
            className="w-40"
            avatarUrl={undefined}
            fixedHeight={fixedHeight}
          />
        }
      </WithInlineHelp>
      {anyProfile ?
        <WithInlineHelp
          iconOffsetTop="58%"
          helpText={`${label} Reddit account's username.`}
        >
          <Username
            username={anyProfile.username}
            badge={
              profile?.hasPremium ? "premium"
              : anyProfile.isSuspended ?
                "suspended"
              : null
            }
          />
        </WithInlineHelp>
      : <Username username="" emptyUsernamePlaceholder={false} />}
    </section>
  );
}

function Username({
  username,
  emptyUsernamePlaceholder = true,
  badge,
}: {
  username: string;
  emptyUsernamePlaceholder?: boolean;
  badge?: "premium" | "suspended" | null;
}): JSX.Element {
  const placeholder =
    username ? null
    : emptyUsernamePlaceholder ? "ellipsis"
    : "blank";
  return (
    <p
      className={`text-lg mt-2 text-center relative ${
        placeholder === "ellipsis" ? "opacity-30"
        : placeholder === "blank" ? "invisible"
        : ""
      }`}
    >
      <span aria-hidden="true">
        <span className="text-sm font-medium">u</span>/
      </span>
      {!placeholder ?
        <span aria-label="username">{username}</span>
      : <span aria-hidden="true">…</span>}
      {badge === "premium" ?
        // Icon sits to the right of username without affecting the username's
        // central position. So we use absolute positioning.
        <>
          <RedditPremiumIcon className="inline absolute top-1/2 translate-x-2 -translate-y-1/2" />
          <span aria-label="user type" className="sr-only">
            Reddit Premium User
          </span>
        </>
      : badge === "suspended" ?
        <>
          <BlockIcon
            title="Suspended User"
            className="inline absolute top-1/2 translate-x-2 -translate-y-1/2 text-red-500 w-5"
          />
          <span aria-label="user type" className="sr-only">
            Suspended User
          </span>
        </>
      : undefined}
    </p>
  );
}

function RedditPremiumIcon({
  className,
  ariaLabel,
}: {
  className?: string;
  ariaLabel?: string;
}): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={twMerge("text-[#D93A00]", className)}
      aria-label={ariaLabel}
      width={pxNumbersAsRem(20)}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <title>Reddit Premium Logo</title>
      <path d="M19.493 1.615a.629.629 0 0 0-.493-.24h-.877c-2.688 0-5.365-.33-7.972-.98a.594.594 0 0 0-.3 0c-2.608.65-5.285.98-7.972.98h-.88a.624.624 0 0 0-.605.776 32.91 32.91 0 0 1 .98 7.972v3.851a4.089 4.089 0 0 0 4.085 4.084 6.764 6.764 0 0 1 4.155 1.434.627.627 0 0 0 .772 0 6.764 6.764 0 0 1 4.155-1.434 4.09 4.09 0 0 0 4.084-4.084v-3.85c0-2.688.33-5.365.98-7.973a.625.625 0 0 0-.112-.536Zm-2.118 12.36a2.837 2.837 0 0 1-2.834 2.833A8.022 8.022 0 0 0 10 18.225V9.5H2.608a34.2 34.2 0 0 0-.817-6.875h.086c2.737 0 5.464-.33 8.123-.98V9.5h7.392c0 .208-.017.415-.017.623v3.851Z"></path>
    </svg>
  );
}
