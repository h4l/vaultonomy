import { LinkButton } from "./Button";
import { Link } from "./Link";
import { VaultonomyLogo } from "./VaultonomyLogo";
import { GitHubLogo, RecommendIcon, RedditIconMono, ScoreIcon } from "./icons";
import { useVaultonomyStore } from "./state/useVaultonomyStore";

const campaignParams =
  "utm_medium=in-app&utm_source=vaultonomy&utm_campaign=footer-review-cta";
const footerReviewCTAChromeWebStoreUrl = `https://chromewebstore.google.com/detail/vaultonomy/jchkniacnpkclejcbhajgajhjbgnfagi?${campaignParams}`;
const footerReviewCTAFirefoxAddOnsUrl = `https://addons.mozilla.org/firefox/addon/vaultonomy/?${campaignParams}`;

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
        <div className="flex gap-4 shrink">
          <Link
            title="Vaultonomy's code on GitHub"
            href="https://github.com/h4l/vaultonomy"
            className="flex flex-wrap gap-1 justify-center items-center text-center"
          >
            <GitHubLogo className="w-6 basis-6 -translate-y-[0.1rem]" />
            <span>Open-source</span>
          </Link>
          <Link
            title="The Vaultonomy subreddit"
            href="https://www.reddit.com/r/vaultonomy"
            className="flex flex-wrap gap-1 justify-center items-center text-center"
          >
            <RedditIconMono className="w-6 basis-6 -translate-y-[0.1rem]" />
            <span>r/vaultonomy</span>
          </Link>
        </div>
      </div>
      <div className="text-center">
        <Link
          href="https://app.ens.domains/vaultonomy.eth"
          className="flex flex-col"
        >
          vaultonomy.eth
        </Link>
        <VaultonomyLogo className="w-32 mt-2" />
      </div>
      <div className="flex justify-start">
        <div className="flex gap-4 shrink">
          <Link
            {...(VAULTONOMY.browserTarget === "chrome" ?
              {
                href: footerReviewCTAChromeWebStoreUrl,
                title: "Vaultonomy on Chrome Web Store",
              }
            : {
                href: footerReviewCTAFirefoxAddOnsUrl,
                title: "Vaultonomy on Firefox Add-ons",
              })}
            className="flex flex-wrap gap-1 justify-center items-center text-center leading-tight"
          >
            <RecommendIcon className="w-full basis-6 -translate-y-[0.1rem]" />
            <div>Leave a review</div>
          </Link>
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
