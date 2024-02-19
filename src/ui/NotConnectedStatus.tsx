import { ReservedSpace } from "./ReservedSpace";
import { ErrorIcon } from "./icons";

export function NotConnectedStatus(): JSX.Element {
  return (
    <>
      <ReservedSpace required={true} height={200} />
      <div
        className={[
          "fixed z-20 -top-8 -inset-x-8 px-12 py-4 -rotate-1",
          "bg-gradient-to-t via-25% from-neutral-25 to-neutral-100",
          "dark:from-neutral-800 dark:to-neutral-875",
          "shadow-2xl _dark:shadow-solid-bottomleft dark:shadow-2xl-heavy",
        ].join(" ")}
      >
        {/* TODO: dark styles */}
        <div className="border-b border-neutral-200 dark:border-neutral-750 py-4 flex flex-row justify-center">
          <div className="max-w-prose mb-4 pl-12">
            <h2
              className={[
                "relative mt-14 text-2xl font-bold",
                "underline underline-offset-4 decoration-wavy decoration-red-500",
              ].join(" ")}
            >
              <ErrorIcon className="absolute -left-12 inline-block" /> No
              connection to Reddit
            </h2>
            <p className="text-lg">
              Open Vaultonomy while viewing a Reddit tab
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
