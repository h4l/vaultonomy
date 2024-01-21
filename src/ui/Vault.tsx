import { useContext } from "react";
import { useEnsName } from "wagmi";

import { AccountVaultAddress } from "../reddit/api-client";
import { EthAccount } from "./EthAccount";
import { WithInlineHelp } from "./Help";
import { VaultonomyStateContext } from "./state/VaultonomyState";

function activeVaultAddress(
  vaultAddresses?: ReadonlyArray<AccountVaultAddress>,
): AccountVaultAddress | undefined {
  return vaultAddresses?.find((va) => va.isActive);
}

export function Vault(): JSX.Element {
  const [vaultonomy, dispatch] = useContext(VaultonomyStateContext);

  const vaultAddresses =
    vaultonomy.redditState.state === "tabAvailable" &&
    vaultonomy.redditState.vaultAddresses?.state === "loaded"
      ? vaultonomy.redditState.vaultAddresses.value
      : undefined;

  const activeVault = activeVaultAddress(vaultAddresses);
  const ensName = useEnsName({
    address: activeVault?.address,
    query: {
      staleTime: 1000 * 60,
    },
  });

  return (
    <EthAccount
      title="Reddit Vault"
      ethAddress={activeVault && activeVault.address}
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
