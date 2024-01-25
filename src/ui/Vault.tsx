import { useEnsName } from "wagmi";

import { EthAccount } from "./EthAccount";
import { WithInlineHelp } from "./Help";
import { useIsRedditAvailable } from "./hooks/useIsRedditAvailable";
import { useRedditAccountActiveVault } from "./hooks/useRedditAccountActiveVault";

export function Vault(): JSX.Element {
  const isRedditAvailable = useIsRedditAvailable();
  const activeVault = useRedditAccountActiveVault();

  const vaultAddress =
    isRedditAvailable && activeVault.data
      ? activeVault.data.address
      : undefined;

  // const activeVault = activeVaultAddress(vaultAddresses);
  const ensName = useEnsName({
    address: vaultAddress,
    query: {
      staleTime: 1000 * 60,
    },
  });

  return (
    <EthAccount
      title="Reddit Vault"
      ethAddress={vaultAddress}
      ensName={ensName.data ?? undefined}
      footer={
        <WithInlineHelp helpText="The date when this Ethereum account was paired with your Reddit account to create this Vault.">
          <span aria-label="status" className="italic text-sm">
            Paired 5 minutes ago
          </span>
        </WithInlineHelp>
      }
    />
  );
}
