import { ForwardedRef, forwardRef, useRef, useState } from "react";

import { EthAccountDetails, FadeOut } from "./EthAccount";
import { WithInlineHelp } from "./Help";
import { UserProfile } from "./UserProfile";
import { useEnableScrollSnapWhileElementOnScreen } from "./hooks/useEnableScrollSnapWhileElementOnScreen";
import { useRedditUserProfile } from "./hooks/useRedditUserProfile";
import { useRedditUserVault } from "./hooks/useRedditUserVault";
import { useDoSearchForUser } from "./hooks/useSearchForUser";
import { SearchIcon } from "./icons";
import { useVaultonomyStore } from "./state/useVaultonomyStore";

export function UserSearch(): JSX.Element {
  const ref = useRef<HTMLElement>(null);
  useEnableScrollSnapWhileElementOnScreen(ref);

  const [searchForUserQuery, searchForUserResult] = useVaultonomyStore(
    (store) => [store.searchForUserQuery, store.searchForUserResult],
  );
  const [rawQuery, setRawQuery] = useState<string>(
    searchForUserQuery?.rawQuery ?? "",
  );

  const resultUsername = searchForUserResult?.value?.username;
  const resultUserProfile = useRedditUserProfile({
    username: searchForUserResult?.value?.username,
  });
  const resultUserVault = useRedditUserVault({
    query:
      resultUsername ? { type: "username", value: resultUsername } : undefined,
  });
  const hasVault =
    resultUserVault.isFetched ? !!resultUserVault.data?.address : undefined;

  const doSearch = useDoSearchForUser();

  return (
    <section
      ref={ref}
      className="min-h-[500px] flex flex-col justify-center items-center"
    >
      <div className="my-16 _opacity-25">
        <UserProfile label="Searched" profile={resultUserProfile.data} />
      </div>
      <WithInlineHelp
        iconOffsetLeft="-0.6rem"
        // iconOffsetBottom="3.875rem"
        helpId="vault-search"
        helpText={() => (
          <>
            Find a Reddit user's Vault address by searching for their username.
            Or find the owner of a Vault by searching for a <code>0x…</code>{" "}
            address.
          </>
        )}
      >
        <div className="relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4">
            <SearchIcon className="w-8 text-neutral-500" />
          </div>
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              doSearch.mutate({ rawQuery });
            }}
          >
            <input
              value={rawQuery}
              onChange={(ev) => {
                // TODO: validate query by parsing
                setRawQuery(ev.currentTarget.value);
              }}
              type="text"
              name="user-vault"
              id="search-user-vault"
              className={[
                "block h-16 w-80 rounded-md",
                "border-0 pt-1.5 pb-[0.125rem] pl-14",
                // "text-gray-900 placeholder:text-gray-400",
                "bg-neutral-50 dark:bg-neutral-900",
                "placeholder:text-neutral-400 dark:placeholder:text-neutral-600",
                "ring-1 ring-inset ring-neutral-300 dark:ring-neutral-700",
                // "focus:ring-2 focus:ring-inset focus:ring-indigo-600",
                "focus:ring-2 focus:ring-inset focus:ring-logo-background",
                // "text-base sm:text-sm sm:leading-6",
                "text-lg",
              ].join(" ")}
              placeholder="Username, 0x… or .eth address"
            />
          </form>
        </div>
      </WithInlineHelp>
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
