import { ForwardedRef, forwardRef, useEffect, useRef, useState } from "react";

import { assert } from "../assert";
import { log } from "../logging";
import { EthAccountDetails, FadeOut } from "./EthAccount";
import { WithInlineHelp } from "./Help";
import { IndeterminateProgressBar } from "./IndeterminateProgressBar";
import { UserProfile } from "./UserProfile";
import { useEnableScrollSnapWhileElementOnScreen } from "./hooks/useEnableScrollSnapWhileElementOnScreen";
import { useRedditUserProfile } from "./hooks/useRedditUserProfile";
import { useRedditUserVault } from "./hooks/useRedditUserVault";
import {
  InvalidParsedQuery,
  ParsedQuery,
  ValidParsedQuery,
  parseQuery,
  useSearchForUser,
} from "./hooks/useSearchForUser";
import { CloseIcon, SearchIcon } from "./icons";
import { useVaultonomyStore } from "./state/useVaultonomyStore";

export function UserSearch(): JSX.Element {
  const ref = useRef<HTMLElement>(null);
  useEnableScrollSnapWhileElementOnScreen(ref);

  // const [searchForUserQuery, searchForUserResult] = useVaultonomyStore(
  //   (store) => [store.searchForUserQuery, store.searchForUserResult],
  // );

  const [currentQuery, setCurrentQuery] = useState<ValidParsedQuery>();
  const search = useSearchForUser({ query: currentQuery });

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

  const activity: Activity =
    search.isLoading ? "search-loading"
    : resultUserProfile.isLoading || resultUserVault.isLoading ? "data-loading"
    : search.isRefetching ? "search-revalidating"
    : resultUserProfile.isRefetching || resultUserVault.isRefetching ?
      "data-revalidating"
    : "idle";

  return (
    <section
      ref={ref}
      className="min-h-[500px] flex flex-col justify-center items-center"
    >
      <div className="my-16 _opacity-25">
        <UserProfile
          label="Searched"
          profile={resultUserProfile.data ?? undefined}
        />
      </div>
      <SearchForm
        onQuery={setCurrentQuery}
        activity={activity}
        // activity="search-revalidating"
      />
      <div className="mt-16">
        <EthAccountDetails
          title="User's Vault"
          ethAddress={resultUserVault.data?.address}
          footer={
            hasVault === false ?
              <FadeOut>{<p>{resultUsername} has no Vault</p>}</FadeOut>
            : undefined
          }
        />
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
}: {
  onQuery: (query: ValidParsedQuery | undefined) => void;
  activity: Activity;
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
  // TODO: persist to store on currentQuery change?
  // useEffect(() => {}, [currentQuery]);

  return (
    <WithInlineHelp
      iconOffsetLeft="-0.6rem"
      // iconOffsetBottom="3.875rem"
      helpId="vault-search"
      helpText={() => (
        <>
          Find a Reddit user's Vault address by searching for their username. Or
          find the owner of a Vault by searching for a <code>0x…</code> address.
        </>
      )}
    >
      <form
        className="relative"
        onSubmit={(ev) => {
          ev.preventDefault();
          onQuery(
            parsedQuery?.type === "invalid-query" ? undefined : parsedQuery,
          );
        }}
      >
        <div
          className={[
            "relative rounded-md shadow-[0_0_1.25rem_0.125rem_rgb(0_0_0_/_0.05)]",
            "overflow-clip",
            // "border border-neutral-300 dark:border-neutral-700",
            "ring-1 _ring-inset ring-neutral-300 dark:ring-neutral-700",
            "has-[:focus]:ring-2 _focus:ring-inset has-[:focus]:ring-logo-background",
            "has-[:autofill]:ring-yellow-500 has-[:autofill:focus]:ring-yellow-500",
            // " has-[:autofill]:border-blue-500",
          ].join(" ")}
        >
          <div className="z-20 absolute inset-y-0 left-0 flex items-center pl-4">
            <SearchIcon className="w-8 text-neutral-500" />
          </div>
          {rawQuery ?
            <button
              type="button"
              className={[
                "z-20 absolute inset-y-0 right-0 flex items-center pr-2",
                "cursor-pointer",
              ].join(" ")}
              onClick={() => {
                setRawQuery("");
                inputEl.current?.focus();
              }}
            >
              <CloseIcon title="Clear" className="w-6 text-neutral-500" />
            </button>
          : undefined}
          <input
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
            name="user-vault"
            id="search-user-vault"
            className={[
              "relative _z-10 bg-transparent bg-none", // render border over the progress bar
              "block h-16 w-80 _rounded-md",
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

          {true || activity !== "idle" ?
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
        {(
          parsedQuery?.type === "invalid-query" &&
          parsedQuery.reason !== "empty"
        ) ?
          <label
            htmlFor="search-user-vault"
            className="text-red-500 inline-block m-2 text-center w-full _ml-16"
          >
            {getInvalidQueryMessage(parsedQuery)}
          </label>
        : undefined}
      </form>
    </WithInlineHelp>
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
  return invalidQuery.reason === "multiple" ? "Enter one word" : "Try harder!";
}
