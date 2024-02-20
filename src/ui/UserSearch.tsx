import { ForwardedRef, forwardRef, useRef } from "react";

import { EthAccountDetails, FadeOut } from "./EthAccount";
import { WithInlineHelp } from "./Help";
import { UserProfile } from "./UserProfile";
import { useEnableScrollSnapWhileElementOnScreen } from "./hooks/useEnableScrollSnapWhileElementOnScreen";
import { SearchIcon } from "./icons";

export function UserSearch(): JSX.Element {
  const ref = useRef<HTMLElement>(null);
  useEnableScrollSnapWhileElementOnScreen(ref);

  return (
    <section
      ref={ref}
      className="min-h-[500px] flex flex-col justify-center items-center"
    >
      <div className="my-16 _opacity-25">
        <UserProfile label="Searched" profile={undefined} />
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
          <input
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
            placeholder="Username or 0x… address"
          />
        </div>
      </WithInlineHelp>
      <div className="mt-16">
        <EthAccountDetails
          title="User's Vault"
          ethAddress={undefined}
          footer={
            <>
              <FadeOut>{/* <p>h4l has no Vault</p> */}</FadeOut>
            </>
          }
        />
      </div>
    </section>
  );
}
