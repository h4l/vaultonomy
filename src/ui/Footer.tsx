import { Link } from "./Link";
import { VaultonomyLogo } from "./VaultonomyLogo";
import { GitHubLogo } from "./icons";

export function Footer(): JSX.Element {
  return (
    <footer
      className={[
        "mt-24 mb-12",
        "grid grid-cols-[repeat(3,_fit-content(7rem))] justify-center gap-12",
        "text-neutral-300 text-sm",
      ].join(" ")}
    >
      <div className="mt-6 flex flex-col items-center text-center">
        <span>Vaultonomy is Open-Source</span>
        <GitHubLogo className="w-8" />
      </div>
      <div>
        <Link href="https://vaultonomy.eth.limo">vaultonomy.eth.limo</Link>
        <VaultonomyLogo className="w-32 mt-2" />
      </div>
      <div className="mt-6">
        <div>Like Vaultonomy?</div>
        <div>Leave a review</div>
      </div>
    </footer>
  );
}
