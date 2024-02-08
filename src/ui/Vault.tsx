import { useEnsName } from "wagmi";

import { EthAccount } from "./EthAccount";
import { WithInlineHelp } from "./Help";
import { RelativeTime } from "./RelativeTime";
import { useIsRedditAvailable } from "./hooks/useIsRedditAvailable";
import { useRedditAccountActiveVault } from "./hooks/useRedditAccountActiveVault";

export function Vault({ userId }: { userId: string | undefined }): JSX.Element {
  const isRedditAvailable = useIsRedditAvailable();
  const activeVaultQuery = useRedditAccountActiveVault({ userId });
  const activeVault = (isRedditAvailable && activeVaultQuery.data) || undefined;

  const ensName = useEnsName({
    address: activeVault?.address,
    query: {
      staleTime: 1000 * 60,
    },
  });

  return (
    <EthAccount
      title="Reddit Vault"
      ethAddress={activeVault?.address}
      ensName={ensName.data ?? undefined}
      footer={
        activeVault?.createdAt ?
          <WithInlineHelp helpText="The date when this Ethereum account was paired with your Reddit account to create this Vault.">
            <span aria-label="Date paired" className="italic text-sm">
              <span aria-hidden="true">Paired </span>
              <RelativeTime when={activeVault.createdAt} />
            </span>
          </WithInlineHelp>
        : undefined
      }
    />
  );
}
