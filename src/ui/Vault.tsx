import { EthAccount, FadeOut } from "./EthAccount";
import { WithInlineHelp } from "./Help";
import { RelativeTime } from "./RelativeTime";
import { UseRedditAccountActiveVaultResult } from "./hooks/useRedditAccountVaults";

export function Vault({
  activeVault,
}: {
  activeVault: UseRedditAccountActiveVaultResult;
}): JSX.Element {
  return (
    <EthAccount
      type="connected-vault"
      title="Reddit Vault"
      subtitle={
        !activeVault.isRedditAvailable && activeVault.data === undefined ?
          "Not connected"
        : activeVault.data === null ?
          "No active Vault"
        : undefined
      }
      ethAddress={activeVault?.data?.address}
      footer={
        activeVault?.data?.createdAt ?
          <WithInlineHelp helpText="The date when this Ethereum account was first paired with your Reddit account to create this Vault.">
            <span aria-label="Date paired" className="italic text-sm">
              <span aria-hidden="true" className="pr-1">
                First paired{" "}
              </span>
              <RelativeTime when={activeVault.data.createdAt} />
            </span>
          </WithInlineHelp>
        : !activeVault?.data?.address ?
          <FadeOut />
        : undefined
      }
    />
  );
}
