import { WithInlineHelp } from "./Help";
import { ReservedSpace } from "./ReservedSpace";
import { ErrorIcon, GitHubLogo, VaultonomyExtensionIcon } from "./icons";

export function NotConnectedStatus(): JSX.Element {
  return (
    <>
      <ReservedSpace required={true} height={200} />
      <div
        className={[
          "fixed z-20 -top-8 -inset-x-8 px-12 py-4 -rotate-1",
          "bg-gradient-to-t via-25% from-neutral-25 to-neutral-100",
          "dark:from-neutral-800 dark:to-neutral-875",
          "shadow-2xl dark:shadow-2xl-heavy",
        ].join(" ")}
      >
        {/* TODO: dark styles */}
        <div className="border-b border-neutral-200 dark:border-neutral-750 py-4 flex flex-row justify-center">
          <div className="max-w-prose mb-4 pl-12">
            <WithInlineHelp
              iconOffsetTop="-0.75rem"
              iconOffsetLeft="0.3rem"
              helpId="not-connected-to-reddit"
              helpText={() => (
                <>
                  <p>
                    To manage your Vault, Vaultonomy needs to connect to Reddit
                    on your behalf using a Reddit tab. To respect your privacy,
                    Vaultonomy only requests access to the specific Reddit tab
                    that's active when you click Vaultonomy's extension icon.{" "}
                    <VaultonomyExtensionIcon className="inline w-7" />
                  </p>
                </>
              )}
            >
              <h2
                className={[
                  "relative mt-14 text-2xl font-bold",
                  "underline underline-offset-4 decoration-wavy decoration-red-500",
                ].join(" ")}
              >
                <ErrorIcon className="absolute -left-12 inline-block" /> No
                connection to Reddit
              </h2>
            </WithInlineHelp>
            <p className="text-lg">
              Open Vaultonomy while viewing a Reddit tab
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
