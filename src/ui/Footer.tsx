import { LinkButton } from "./Button";
import { Link } from "./Link";
import { VaultonomyLogo } from "./VaultonomyLogo";
import { GitHubLogo, RecommendIcon, ScoreIcon } from "./icons";
import { useVaultonomyStore } from "./state/useVaultonomyStore";

export function Footer(): JSX.Element {
  const { statsConsent, setStatsConsent } = useVaultonomyStore((s) => ({
    statsConsent: s.statsConsent,
    setStatsConsent: s.setStatsConsent,
  }));

  return (
    <footer
      className={[
        "mt-24 mb-16 mx-4",
        "grid grid-cols-[1fr_fit-content(7rem)_1fr] justify-center items-end gap-4 sm:gap-12",
        "text-neutral-300 text-sm",
      ].join(" ")}
    >
      <div className="flex justify-end">
        <div className="flex shrink">
          <Link
            href="https://github.com/h4l/vaultonomy"
            className="flex flex-wrap gap-2 justify-center items-center text-center"
          >
            <GitHubLogo className="w-6 basis-6 -translate-y-[0.1rem]" />
            <span>Open-source</span>
          </Link>
        </div>
      </div>
      <div>
        <Link href="https://vaultonomy.eth.limo" className="flex flex-col">
          vaultonomy.eth.limo
          <VaultonomyLogo className="w-32 mt-2" />
        </Link>
      </div>
      <div className="flex justify-start">
        <div className="flex gap-2 shrink">
          {/* TODO: link to Chrome / Mozilla store */}
          <div className="flex flex-wrap gap-1 justify-center items-center text-center leading-tight">
            <RecommendIcon className="w-full basis-6 -translate-y-[0.1rem]" />
            <div>Leave a review</div>
          </div>
          <LinkButton
            onClick={() => setStatsConsent(null)}
            className="flex flex-wrap gap-1 justify-center items-center text-center leading-tight"
          >
            <ScoreIcon
              size={24}
              className="w-full basis-6 -translate-y-[0.1rem]"
            />
            <div>Metrics are {statsConsent === "opt-in" ? "on" : "off"}</div>
          </LinkButton>
        </div>
      </div>
    </footer>
  );
}
