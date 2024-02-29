import { useQueryClient } from "@tanstack/react-query";
import { ReactNode, useEffect, useId, useRef, useState } from "react";

import { assert } from "../assert";
import { log } from "../logging";
import { EthAccountDetails, FadeOut } from "./EthAccount";
import { WithInlineHelp } from "./Help";
import { IndeterminateProgressBar } from "./IndeterminateProgressBar";
import { Link } from "./Link";
import { UserProfile } from "./UserProfile";
import { useEnableScrollSnapWhileElementOnScreen } from "./hooks/useEnableScrollSnapWhileElementOnScreen";
import { useRedditUserProfile } from "./hooks/useRedditUserProfile";
import { useRedditUserVault } from "./hooks/useRedditUserVault";
import {
  InvalidParsedQuery,
  ParsedQuery,
  ValidParsedQuery,
  getParsedQueryKey,
  getSearchForUserQueryKey,
  getSearchForUserQueryOptions,
  parseQuery,
  parsedQueryEqual,
  useSearchForUser,
} from "./hooks/useSearchForUser";
import { ErrorIcon, SearchIcon } from "./icons";
import { useVaultonomyStore } from "./state/useVaultonomyStore";

export function UserSearch(): JSX.Element {
  const headingId = useId();
  const ref = useRef<HTMLElement>(null);
  useEnableScrollSnapWhileElementOnScreen(ref);

  const [
    hasHydrated,
    searchForUserQuery,
    searchForUserResult,
    setSearchForUserQuery,
    setSearchForUserResult,
  ] = useVaultonomyStore((store) => [
    store.hasHydrated,
    store.searchForUserQuery,
    store.searchForUserResult,
    store.setSearchForUserQuery,
    store.setSearchForUserResult,
  ]);

  const queryClient = useQueryClient();
  const [currentQuery, setCurrentQuery] = useState<ValidParsedQuery>();

  // Restore persisted search results on startup as the store hydrates from persistent storage
  useEffect(() => {
    if (!hasHydrated || !searchForUserQuery?.rawQuery || !searchForUserResult)
      return;
    log.debug("UserSearch: hasHydrated:", hasHydrated);
    const storedQuery = parseQuery(searchForUserQuery.rawQuery);
    if (storedQuery.type === "invalid-query") return;

    log.debug("Restored UserSearch result from hydrated state");
    queryClient.setQueryData(
      getSearchForUserQueryKey(storedQuery),
      searchForUserResult,
    );
    setCurrentQuery(storedQuery);
  }, [hasHydrated]);

  const search = useSearchForUser({ query: currentQuery });

  // persist successful search results
  useEffect(() => {
    if (search.data?.value && currentQuery) {
      log.debug("Storing user search result:", currentQuery, search.data);
      setSearchForUserResult({
        queryKey: getParsedQueryKey(currentQuery),
        result: search.data,
      });
    }
  }, [search.data?.value, currentQuery]);

  const resultUsername = search?.data?.value?.username;
  const resultUserProfile = useRedditUserProfile({
    username: resultUsername,
  });
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
      <div className="my-16 _opacity-25">
        <UserProfile
          label="Found"
          profile={resultUserProfile.data ?? undefined}
        />
      </div>
      <SearchForm
        onQuery={({ rawQuery, parsedQuery }) => {
          setSearchForUserQuery({
            rawQuery,
            queryKey: getParsedQueryKey(parsedQuery),
          });
          if (parsedQuery.type !== "invalid-query")
            setCurrentQuery(parsedQuery);
        }}
        activity={activity}
        errorMessages={errors}
      />
      <div className="mt-16">
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
  onQuery,
  activity,
  errorMessages = [],
}: {
  onQuery: (options: { rawQuery: string; parsedQuery: ParsedQuery }) => void;
  activity: Activity;
  errorMessages?: string[];
}): JSX.Element {
  const inputEl = useRef<HTMLInputElement>(null);
  // const [
  //   searchForUserQuery,
  //   searchForUserResult,
  //   setSearchForUserQuery,
  //   setSearchForUserResult,
  // ] = useVaultonomyStore((store) => [
  //   store.searchForUserQuery,
  //   store.searchForUserResult,
  //   store.setSearchForUserQuery,
  //   store.setSearchForUserResult,
  // ]);

  // TODO: use persistent store state
  // searchForUserQuery?.rawQuery ?? "",
  const [rawQuery, setRawQueryValue] = useState<string>("");
  const [parsedQuery, setParsedQuery] = useState<ParsedQuery>();
  // useSearchForUser({query: })

  const setRawQuery = (value: string) => {
    const input = inputEl.current;
    assert(input);

    setRawQueryValue(value);
    const parsedQuery = parseQuery(value);
    setParsedQuery(parsedQuery);
    if (
      parsedQuery.type === "invalid-query" &&
      parsedQuery.reason !== "empty"
    ) {
      log.debug("reported invalid");
      input.setCustomValidity(getInvalidQueryMessage(parsedQuery));
    } else {
      log.debug("reported valid");
      input.setCustomValidity("");
    }
    input.reportValidity();
  };

  const queryInvalid =
    parsedQuery?.type === "invalid-query" && parsedQuery.reason !== "empty";
  const allErrorMessages =
    queryInvalid ?
      [getInvalidQueryMessage(parsedQuery), ...errorMessages]
    : errorMessages;

  const lastRunQuery = useRef<ParsedQuery>();
  const runQuery = (trigger: "explicit" | "implicit"): void => {
    if (!parsedQuery) return;
    // Don't make a duplicate callback for implicit triggers (e.g. un-focusing
    // the search box.) Whereas always trigger when explicitly searching (e.g.
    // pressing enter/search button).
    if (
      trigger === "implicit" &&
      lastRunQuery.current &&
      parsedQueryEqual(lastRunQuery.current, parsedQuery)
    ) {
      log.debug("Ignored runQuery for implicit already-run query");
      return;
    }
    log.debug("runQuery", parsedQuery);
    lastRunQuery.current = parsedQuery;
    onQuery({ rawQuery, parsedQuery });
  };

  // TODO: persist to store on currentQuery change?
  // useEffect(() => {}, [currentQuery]);

  return (
    <WithInlineHelp
      iconOffsetLeft="0.1rem"
      iconOffsetTop="-1.2rem"
      // iconOffsetBottom="3.875rem"
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
                Find the owner of a Vault by searching for a <code>0x…</code>{" "}
                address.
              </li>
            </ul>
          </div>
          {/* <p>
            Find a Reddit user’s Vault address by searching for their username.
            Or find the owner of a Vault by searching for a <code>0x…</code>{" "}
            address.
          </p> */}
          <p className="mt-2 text-sm">
            <Link href="https://ens.domains/">ENS names</Link> (like{" "}
            <em>h-a-l.eth</em>) match if they point to a user’s Vault address,
            or have a <code>com.reddit</code> label pointing to a username.
          </p>
        </>
      )}
    >
      <form
        className="relative max-w-prose flex flex-col items-center gap-4"
        onSubmit={(ev) => {
          ev.preventDefault();
          runQuery("explicit");
        }}
        onBlur={(ev) => {
          if (ev.currentTarget.contains(ev.relatedTarget)) {
            log.debug("ignored blur from focus change within self", ev.target);
            return;
          }
          // if (ev.target !== ev.currentTarget) {
          //   return;
          // }
          log.debug("blur", ev.target);
          runQuery("implicit");
        }}
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
            placeholder="Username, 0x… or .eth address"
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
        {allErrorMessages.length ?
          <ErrorMessages messages={allErrorMessages} />
        : undefined}
      </form>
    </WithInlineHelp>
  );
}

function ErrorMessages({ messages }: { messages: string[] }): JSX.Element {
  return (
    <ul aria-label="Search Errors" className="mx-4">
      {messages.map((msg, i) => (
        <li key={i}>
          <ErrorMessage>{msg}</ErrorMessage>
        </li>
      ))}
    </ul>
  );
}

function ErrorMessage({ children }: { children: ReactNode }): JSX.Element {
  return (
    <label
      htmlFor="user-search"
      className={[
        "_text-red-500 my-2 _text-center w-full _ml-16",
        "underline decoration-wavy decoration-red-500 underline-offset-4",
        "flex flex-row gap-x-2",
      ].join(" ")}
    >
      <ErrorIcon size={24} className="_-translate-y-[0.125rem]" />
      <span>{children}</span>
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
