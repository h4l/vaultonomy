import { ReactNode, useEffect, useId, useRef, useState } from "react";

import { assert } from "../assert";
import { log } from "../logging";
import { EthAccountDetails, FadeOut } from "./EthAccount";
import { WithInlineHelp } from "./Help";
import { IndeterminateProgressBar } from "./IndeterminateProgressBar";
import { Link } from "./Link";
import { UserProfile } from "./UserProfile";
import { useRedditUserProfile } from "./hooks/useRedditUserProfile";
import { useRedditUserVault } from "./hooks/useRedditUserVault";
import {
  InvalidParsedQuery,
  NotFoundReason,
  ParsedQuery,
  SearchForUserNotFoundError,
  ValidParsedQuery,
  parseQuery,
  parsedQueryEqual,
  useSearchForUser,
} from "./hooks/useSearchForUser";
import { ErrorIcon, SearchIcon } from "./icons";
import { useVaultonomyStore } from "./state/useVaultonomyStore";

export function UserSearch(): JSX.Element {
  const headingId = useId();
  const ref = useRef<HTMLElement>(null);

  const [
    searchForUserQuery,
    setSearchForUserQuery,
    userOfInterest,
    userOfInterestQuery,
    setUserOfInterest,
  ] = useVaultonomyStore((store) => {
    const userOfInterestQuery = parseQuery(
      store.userOfInterest?.rawUsernameQuery ?? "",
    );
    return [
      store.searchForUserQuery,
      store.setSearchForUserQuery,
      store.userOfInterest,
      userOfInterestQuery.type === "username" ? userOfInterestQuery : undefined,
      store.setUserOfInterest,
    ];
  });

  const [currentQuery, setCurrentQuery] = useState<
    ValidParsedQuery | undefined
  >();

  const search = useSearchForUser({
    query: currentQuery ?? userOfInterestQuery,
  });
  const resultUsername = search?.data?.value?.username;
  const resultUserProfile = useRedditUserProfile({ username: resultUsername });

  const resultUserVault = useRedditUserVault({
    query:
      resultUsername ? { type: "username", value: resultUsername } : undefined,
  });
  const hasVault =
    resultUserVault.isFetched ? !!resultUserVault.data?.address : undefined;

  const errors: string[] = [
    search.isError ? "Vaultonomy hit an error while searching" : undefined,
    resultUserProfile.isError ?
      "Vaultonomy hit an error while loading the user’s profile"
    : undefined,
    resultUserVault.isError ?
      "Vaultonomy hit an error while loading the user’s Vault"
    : undefined,
  ].filter((x): x is string => !!x);

  const activity: Activity =
    search.isLoading ? "search-loading"
    : resultUserProfile.isLoading || resultUserVault.isLoading ? "data-loading"
    : search.isRefetching ? "search-revalidating"
    : resultUserProfile.isRefetching || resultUserVault.isRefetching ?
      "data-revalidating"
    : "idle";

  return (
    <section
      aria-labelledby={headingId}
      ref={ref}
      className="min-h-[500px] flex flex-col justify-center items-center"
    >
      <h2 id={headingId} className="sr-only">
        Find User
      </h2>
      <div className="mt-8 mb-16">
        <UserProfile
          label="Found"
          profile={resultUserProfile.data ?? undefined}
          fixedHeight={true}
        />
      </div>
      <SearchForm
        inputPlaceholder={
          userOfInterest && !currentQuery ?
            userOfInterest.rawUsernameQuery
          : undefined
        }
        defaultRawQuery={searchForUserQuery}
        onQuery={({ rawQuery, parsedQuery }) => {
          setSearchForUserQuery(rawQuery);
          setCurrentQuery(
            parsedQuery.type === "invalid-query" ? undefined : parsedQuery,
          );

          // Clear the automatic user search when the input is cleared
          if (
            parsedQuery.type === "invalid-query" &&
            parsedQuery.reason === "empty"
          ) {
            setUserOfInterest(null);
          }
        }}
        activity={activity}
        notFoundError={search.data?.error}
        errorMessages={errors}
      />
      <div className="mt-8">
        <EthAccountDetails
          title="Vault"
          ethAddress={resultUserVault.data?.address}
        >
          {hasVault === false ?
            <FadeOut>
              {
                <p className="text-center text-neutral-500">
                  <RedditUsernameText>{resultUsername}</RedditUsernameText> has
                  no Vault.
                </p>
              }
            </FadeOut>
          : undefined}
        </EthAccountDetails>
      </div>
    </section>
  );
}

type Activity =
  | "idle"
  | "search-loading"
  | "search-revalidating"
  | "data-loading"
  | "data-revalidating";

function SearchForm({
  inputPlaceholder,
  defaultRawQuery,
  onQuery,
  activity,
  notFoundError,
  errorMessages = [],
}: {
  inputPlaceholder?: string;
  defaultRawQuery: string | undefined;
  onQuery: (options: { rawQuery: string; parsedQuery: ParsedQuery }) => void;
  activity: Activity;
  notFoundError?: SearchForUserNotFoundError;
  errorMessages?: string[];
}): JSX.Element {
  const inputEl = useRef<HTMLInputElement>(null);

  const [userRawQuery, setUserRawQuery] = useState<string>();
  const rawQuery = userRawQuery ?? defaultRawQuery ?? "";
  const parsedQuery = useRef<ParsedQuery>();
  const [parsedQueryError, setParsedQueryError] = useState<
    string | undefined
  >();

  const setRawQuery = (value: string) => {
    const input = inputEl.current;
    assert(input);

    setUserRawQuery(value);
    const thisParsedQuery = parseQuery(value);
    parsedQuery.current = thisParsedQuery;

    if (
      thisParsedQuery.type === "invalid-query" &&
      thisParsedQuery.reason !== "empty"
    ) {
      log.debug("reported invalid");
      const msg = getInvalidQueryMessage(thisParsedQuery);
      setParsedQueryError(msg);
      input.setCustomValidity(msg);
    } else {
      log.debug("reported valid");
      setParsedQueryError(undefined);
      input.setCustomValidity("");
    }
    input.reportValidity();
  };

  const queryInvalid = !!parsedQueryError;
  const allErrorMessages =
    queryInvalid ? [parsedQueryError, ...errorMessages] : errorMessages;

  const lastRunQuery = useRef<ParsedQuery>();
  const runQuery = (trigger: "explicit" | "implicit"): void => {
    if (!parsedQuery.current) return;
    // Don't make a duplicate callback for implicit triggers (e.g. un-focusing
    // the search box.) Whereas always trigger when explicitly searching (e.g.
    // pressing enter/search button).
    if (
      trigger === "implicit" &&
      lastRunQuery.current &&
      parsedQueryEqual(lastRunQuery.current, parsedQuery.current)
    ) {
      log.debug("Ignored runQuery for implicit already-run query");
      return;
    }
    log.debug("runQuery", parsedQuery.current);
    lastRunQuery.current = parsedQuery.current;
    onQuery({ rawQuery, parsedQuery: parsedQuery.current });
  };

  // Allow an asynchronously-set defaultRawQuery to initialise the query
  useEffect(() => {
    if (defaultRawQuery !== undefined && userRawQuery === undefined) {
      setRawQuery(defaultRawQuery);
      runQuery("implicit");
    }
  }, [defaultRawQuery, userRawQuery]);

  return (
    <form
      className="relative max-w-prose flex flex-col items-center gap-4 min-h-[7.5rem]"
      onSubmit={(ev) => {
        ev.preventDefault();
        runQuery("explicit");
      }}
      onBlur={(ev) => {
        if (ev.currentTarget.contains(ev.relatedTarget)) {
          log.debug("ignored blur from focus change within self", ev.target);
          return;
        }
        log.debug("blur", ev.target);
        runQuery("implicit");
      }}
    >
      <WithInlineHelp
        iconOffsetLeft="0.2rem"
        iconOffsetTop="-0.9rem"
        helpId="vault-search"
        helpText={() => (
          <>
            <div className="prose">
              <ul className="list-disc">
                <li>
                  Find a Reddit user’s Vault address by searching for their
                  username.
                </li>
                <li>
                  Find the owner of a Vault by searching for a{" "}
                  <strong>0x…</strong> address.
                </li>
              </ul>
            </div>
            <p className="mt-2 text-sm">
              <Link href="https://ens.domains/">ENS names</Link> (like{" "}
              <strong>h-a-l.eth</strong>) match if they point to a user’s Vault
              address, or have a <strong>com.reddit</strong> label pointing to a
              username.
            </p>
          </>
        )}
      >
        <div
          className={[
            "relative rounded-md shadow-[0_0_1.25rem_0.125rem_rgb(0_0_0_/_0.05)]",
            "overflow-clip",
            // "border border-neutral-300 dark:border-neutral-700",
            "ring-1 _ring-inset ring-neutral-300 dark:ring-neutral-700",
            "has-[:focus]:ring-2 _focus:ring-inset has-[:focus]:ring-logo-background",
            "has-[:autofill]:ring-yellow-800 has-[:autofill:focus]:ring-yellow-800",
          ].join(" ")}
        >
          <input
            aria-label="Search for Reddit user."
            ref={inputEl}
            value={rawQuery}
            onChange={(ev) => {
              const value = ev.currentTarget.value;
              setRawQuery(value);
            }}
            onInvalid={(ev) => {
              // prevent the browser showing a default invalid tooltip
              ev.preventDefault();
            }}
            enterKeyHint="search"
            type="text"
            spellCheck={false}
            name="user-search"
            id="user-search"
            className={[
              "peer relative bg-transparent bg-none", // render border over the progress bar
              "block h-16 w-80",
              "border-0 pt-1.5 pb-[0.125rem] pl-14",
              // "text-gray-900 placeholder:text-gray-400",
              // "bg-neutral-50 dark:bg-neutral-900",
              "placeholder:text-neutral-400 dark:placeholder:text-neutral-600",
              // "ring-1 ring-inset ring-neutral-300 dark:ring-neutral-700",
              // "focus:ring-2 focus:ring-inset focus:ring-logo-background",
              // "text-base sm:text-sm sm:leading-6",
              "invalid:underline invalid:decoration-wavy invalid:decoration-red-500 invalid:ring-red-500 invalid:focus:ring-red-500",
              "text-lg",
              // "autofill:shadow-[inset_0_0_0px_100px_rgb(255_255_0_/_0.5)]",
            ].join(" ")}
            placeholder={inputPlaceholder ?? "Username, 0x… or .eth address"}
          />
          <div className="absolute inset-y-0 left-0 flex items-center pl-4">
            <button
              aria-label="Perform Search."
              type="submit"
              className={queryInvalid ? "cursor-not-allowed" : "cursor-pointer"}
            >
              <SearchIcon className="w-8 text-neutral-500" />
            </button>
          </div>

          {activity !== "idle" ?
            <div className="absolute bottom-0 inset-x-0">
              <IndeterminateProgressBar
                className={
                  (
                    "transition-opacity " +
                    (activity === "data-revalidating" ||
                      activity === "search-revalidating")
                  ) ?
                    "opacity-50"
                  : ""
                }
                reverse={
                  activity === "search-loading" ||
                  activity === "search-revalidating"
                }
              />
            </div>
          : undefined}
        </div>
      </WithInlineHelp>
      {allErrorMessages.length || notFoundError ?
        <ErrorMessages
          notFoundError={notFoundError}
          messages={allErrorMessages}
        />
      : undefined}
    </form>
  );
}

function ErrorMessages({
  notFoundError,
  messages,
}: {
  notFoundError: SearchForUserNotFoundError | undefined;
  messages: string[];
}): JSX.Element {
  return (
    <ul aria-label="Search Errors" className="mx-4">
      <li key="not-found">
        {notFoundError ?
          <UserNotFound notFound={notFoundError} />
        : undefined}
      </li>
      {messages.map((msg, i) => (
        <li key={i}>
          <ErrorMessage>
            <ErrorMessageHeadline>{msg}</ErrorMessageHeadline>
          </ErrorMessage>
        </li>
      ))}
    </ul>
  );
}

function ErrorMessageHeadline({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="underline decoration-wavy decoration-red-500 underline-offset-4">
      {children}
    </div>
  );
}

function ErrorMessage({ children }: { children: ReactNode }): JSX.Element {
  return (
    <label
      htmlFor="user-search"
      className="my-2 flex flex-row gap-x-2 items-start"
    >
      <ErrorIcon size={24} className="_-translate-y-[0.125rem]" />
      <div>{children}</div>
    </label>
  );
}

function getInvalidQueryMessage(invalidQuery: InvalidParsedQuery): string {
  const messages: Record<InvalidParsedQuery["reason"], string> = {
    "address-checksum": "Address is not valid, double check it",
    address: "Address is not valid, double check it",
    "ens-name": "ENS name is not valid",
    "username-length": "Reddit username is too long",
    empty: "Enter something to search for",
    multiple: "Search for one thing at a time",
    username: "Reddit username is not valid",
  };
  return messages[invalidQuery.reason];
}

function RedditUsernameText({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <>
      <span aria-hidden="true">
        <span className="text-sm font-medium">u</span>/
      </span>
      <span aria-label="username">{children}</span>
    </>
  );
}

const NOT_FOUND_REASONS: Record<ValidParsedQuery["type"], string> = {
  username: "Nobody on Reddit has this username",
  address: "Nobody on Reddit has a Vault with this address",
  "ens-name": "Nobody on Reddit matches this ENS name",
};
const ENS_NOT_FOUND_DETAIL: Partial<Record<NotFoundReason, ReactNode>> = {
  "ens-name-has-no-address": (
    <>
      It does not point to a <strong>0x…</strong> address
    </>
  ),
  "ens-name-address-not-a-vault": (
    <>
      No Vaults match its <strong>0x…</strong> address
    </>
  ),
  "ens-name-has-no-com-reddit": (
    <>
      It has no <b>com.reddit</b> record
    </>
  ),
  "ens-name-com-reddit-username-not-found": (
    <>
      Its <strong>com.reddit</strong> record is not anybody's username
    </>
  ),
};

function UserNotFound({
  notFound,
}: {
  notFound: SearchForUserNotFoundError;
}): JSX.Element {
  const details = notFound.tags
    .map((tag) => ENS_NOT_FOUND_DETAIL[tag])
    .filter((x): x is ReactNode => !!x);
  return (
    <ErrorMessage>
      <ErrorMessageHeadline>
        {NOT_FOUND_REASONS[notFound.query.type]}
      </ErrorMessageHeadline>
      {details.length > 0 ?
        <ul className="text-sm m-2 list-disc">
          {details.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      : undefined}
    </ErrorMessage>
  );
}
