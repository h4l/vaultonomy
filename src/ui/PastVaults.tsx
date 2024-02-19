import { AccountVaultAddress } from "../reddit/api-client";
import { EthAccountDetails, FadeOut } from "./EthAccount";
import { Heading } from "./Heading";
import { WithInlineHelp } from "./Help";
import { RelativeTime } from "./RelativeTime";
import { useRedditAccountVaults } from "./hooks/useRedditAccountVaults";

export function PastVaults({
  userId,
}: {
  userId: string | undefined;
}): JSX.Element {
  const vaults = useRedditAccountVaults({ userId });

  return (
    <section aria-labelledby="past-vaults">
      <Heading
        id="past-vaults"
        className={`mt-0 mb-10 row-start-1 col-start-1 col-span-6 flex flex-row justify-center`}
      >
        Past Vaults
      </Heading>
      <div className="mx-10 flex flex-row flex-wrap justify-center gap-x-40 gap-y-20">
        {vaults.data?.pastVaults.length === 0 ?
          <>
            <NoPastVaults />
          </>
        : vaults.data?.pastVaults.map((vault, i) => (
            <PastVault key={i} vault={vault} />
          ))
        }
      </div>
    </section>
  );
}

function NoPastVaults() {
  return (
    <>
      <EthAccountDetails title="Past Vault" ethAddress={undefined}>
        <FadeOut>
          <p className="text-center text-neutral-500">
            You don't have any inactive Vaults.
          </p>
        </FadeOut>
      </EthAccountDetails>
    </>
  );
}

function PastVault({ vault }: { vault: AccountVaultAddress }): JSX.Element {
  return (
    <EthAccountDetails
      title="Past Vault"
      ethAddress={vault.address}
      footer={
        <>
          <WithInlineHelp
            helpText="The dates when this Vault's Ethereum account was paired with, and un-paired from your Reddit account."
            iconOffsetBottom="0.75rem"
            iconOffsetLeft="-1.5rem"
          >
            <div className="mt-2 -ml-5 grid grid-cols-[auto_1fr] gap-x-2 italic text-sm leading-snug">
              <span aria-hidden="true" className="justify-self-end">
                Paired
              </span>
              <span aria-label="Date paired" className="justify-self-start">
                <RelativeTime when={vault.createdAt} />
              </span>
              <span aria-hidden="true" className="justify-self-end">
                Un-paired
              </span>
              <span aria-label="Date un-paired" className="justify-self-start">
                {vault.modifiedAt === null ?
                  <em>unknown</em>
                : <RelativeTime when={vault.modifiedAt} />}
              </span>
            </div>
          </WithInlineHelp>
        </>
      }
    />
  );
}
