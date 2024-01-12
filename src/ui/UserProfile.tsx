import { RedditUserProfile } from "../reddit/reddit-interaction-spec";
import { WithInlineHelp } from "./Help";
import { UserAvatar } from "./UserAvatar";

export function UserProfile({
  profile,
}: {
  profile?: RedditUserProfile;
}): JSX.Element {
  return (
    <section
      aria-label="Reddit account details"
      className="flex flex-col items-center"
    >
      <span aria-label="status" className="sr-only">
        {profile === undefined
          ? "Disconnected from Reddit"
          : "Connected to Reddit"}
      </span>
      <WithInlineHelp
        iconOffsetLeft="0.5rem"
        iconOffsetBottom="3.875rem"
        helpText="Your Reddit account's avatar."
      >
        <UserAvatar
          className="w-40"
          avatarUrl={profile?.accountIconFullBodyURL}
        />
      </WithInlineHelp>
      {profile ? (
        <WithInlineHelp
          iconOffsetTop="58%"
          helpText="Your Reddit account's username."
        >
          <Username
            username={profile.username}
            hasPremium={profile.hasPremium}
          />
        </WithInlineHelp>
      ) : undefined}
    </section>
  );
}

function Username({
  username,
  hasPremium,
}: {
  username: string;
  hasPremium: boolean;
}): JSX.Element {
  return (
    <p className="text-lg mt-2 text-center relative">
      <span aria-hidden="true">
        <span className="text-sm font-medium">u</span>/
      </span>
      {username ? (
        <span aria-label="username">{username}</span>
      ) : (
        <span aria-hidden="true">???</span>
      )}
      {hasPremium ? (
        // Icon sits to the right of username without affecting the username's
        // central position. So we use absolute positioning.
        <>
          <RedditPremiumIcon className="inline absolute top-1/2 translate-x-1 -translate-y-1/2" />
          <span aria-label="user type" className="sr-only">
            Reddit Premium User
          </span>
        </>
      ) : undefined}
    </p>
  );
}

function RedditPremiumIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="21"
      viewBox="0 0 20 21"
      fill="none"
    >
      <title>Reddit Premium Logo</title>
      <g clipPath="url(#clip0_24_139)">
        <path
          d="M20 10.368C20 4.84513 15.5228 0.367981 10 0.367981C4.47715 0.367981 0 4.84513 0 10.368C0 15.8908 4.47715 20.368 10 20.368C15.5228 20.368 20 15.8908 20 10.368Z"
          fill="url(#paint0_linear_24_139)"
        />
        <path
          d="M12.1211 13.839C11.1141 13.985 10.3911 14.284 10.0001 14.482V11.414C10.0001 11.0957 9.87364 10.7905 9.6486 10.5655C9.42355 10.3404 9.11833 10.214 8.80007 10.214H6.53007C6.55707 9.92198 6.57607 9.60398 6.57607 9.23598C6.57607 8.22098 6.28207 7.45598 6.04607 7.00298L6.88007 6.16898H10.0001V9.01398C10.0001 9.33224 10.1265 9.63747 10.3515 9.86251C10.5766 10.0876 10.8818 10.214 11.2001 10.214H13.4701C13.5061 10.616 13.5561 10.963 13.6021 11.259C13.6601 11.639 13.7111 11.965 13.7111 12.306C13.7111 12.933 13.2141 13.681 12.1211 13.839ZM15.1381 6.48898L13.7931 5.14398C13.7372 5.08831 13.6709 5.0442 13.598 5.01417C13.5251 4.98414 13.4469 4.96879 13.3681 4.96898H6.63207C6.5532 4.96879 6.47507 4.98414 6.40215 5.01417C6.32922 5.0442 6.26293 5.08831 6.20707 5.14398L4.86207 6.48998C4.75719 6.59484 4.69486 6.73482 4.6871 6.88292C4.67935 7.03102 4.72671 7.17675 4.82007 7.29198C4.82607 7.29798 5.37607 8.01198 5.37607 9.23598C5.37607 10.019 5.28907 10.58 5.21207 11.076C5.14807 11.486 5.08807 11.873 5.08807 12.306C5.08807 13.469 5.98807 14.777 7.70707 15.026C8.95807 15.209 9.65907 15.664 9.66307 15.666C9.76237 15.7317 9.87871 15.7668 9.99777 15.7672C10.1168 15.7676 10.2334 15.7331 10.3331 15.668C10.3401 15.664 11.0421 15.208 12.2931 15.026C14.0121 14.777 14.9111 13.469 14.9111 12.306C14.9111 11.873 14.8511 11.486 14.7871 11.076C14.6814 10.4683 14.6268 9.85279 14.6241 9.23598C14.6241 8.01598 15.1601 7.31698 15.1801 7.29198C15.2734 7.17675 15.3208 7.03102 15.313 6.88292C15.3053 6.73482 15.2429 6.59484 15.1381 6.48998V6.48898Z"
          fill="white"
        />
      </g>
      <defs>
        <linearGradient
          id="paint0_linear_24_139"
          x1="0"
          y1="20.368"
          x2="20.021"
          y2="20.347"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#EC0623" />
          <stop offset="1" stopColor="#FF8717" />
        </linearGradient>
        <clipPath id="clip0_24_139">
          <rect
            width="20"
            height="20"
            fill="white"
            transform="translate(0 0.367981)"
          />
        </clipPath>
      </defs>
    </svg>
  );
}
