import { Button } from "./Button";
import { WithInlineHelp } from "./Help";
import { Link } from "./Link";
import { ScoreIcon } from "./icons";
import { useVaultonomyStoreSingle } from "./state/useVaultonomyStore";

export function StatsConsent(): JSX.Element {
  const setStatsConsent = useVaultonomyStoreSingle((s) => s.setStatsConsent);

  return (
    <>
      <WithInlineHelp
        iconOffsetTop="-0.75rem"
        iconOffsetLeft="0.3rem"
        helpText={
          "Change your mind any time with the link at the bottom of the page."
        }
      >
        <h2
          className={[
            "relative mt-12 text-2xl font-bold",
            "underline underline-offset-[0.4rem] decoration-blue-500",
          ].join(" ")}
        >
          <ScoreIcon className="absolute -left-12 inline-block" /> Contribute to
          metrics?
        </h2>
      </WithInlineHelp>
      <p className="text-lg mt-2">
        Vaultonomyʼs developers use metrics to know where to focus development
        effort and demonstrate impact. Can Vaultonomy collect metrics on how
        itʼs being used? Metrics are generic, nothing that could identify a user
        is included, see the{" "}
        <Link href="https://github.com/h4l/vaultonomy/blob/dev/docs/privacy.md">
          privacy policy
        </Link>
        .
      </p>
      <p className="flex flex-row gap-6 mt-6">
        <Button size="l" className="" onClick={() => setStatsConsent("opt-in")}>
          Yes! Metrics.
        </Button>
        <Button
          size="l"
          className=""
          onClick={() => setStatsConsent("opt-out")}
        >
          No metrics!
        </Button>
      </p>
    </>
  );
}
