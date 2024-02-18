import { useEnsName } from "wagmi";

import { EthAccount } from "./EthAccount";
import { WithInlineHelp } from "./Help";
import { RelativeTime } from "./RelativeTime";
import { UseRedditAccountActiveVaultResult } from "./hooks/useRedditAccountVaults";

export function Vault({
  activeVault,
}: {
  activeVault: UseRedditAccountActiveVaultResult;
}): JSX.Element {
  const ensName = useEnsName({
    address: activeVault?.data?.address,
    query: {
      staleTime: 1000 * 60,
    },
  });
  return (
    <EthAccount
      title="Reddit Vault"
      subtitle={!activeVault ? "No active Vault" : undefined}
      ethAddress={activeVault?.data?.address}
      ensName={ensName.data ?? undefined}
      footer={
        activeVault?.data?.createdAt ?
          <WithInlineHelp helpText="The date when this Ethereum account was paired with your Reddit account to create this Vault.">
            <span aria-label="Date paired" className="italic text-sm">
              <span aria-hidden="true">Paired </span>
              <RelativeTime when={activeVault.data.createdAt} />
            </span>
          </WithInlineHelp>
        : undefined
      }
    />
  );
}
