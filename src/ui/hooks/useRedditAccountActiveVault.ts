import { useQuery } from "@tanstack/react-query";

import { AccountVaultAddress } from "../../reddit/api-client";
import { useRedditProvider } from "./useRedditProvider";

function activeVaultAddress(
  vaultAddresses?: ReadonlyArray<AccountVaultAddress>,
): AccountVaultAddress | undefined {
  return vaultAddresses?.find((va) => va.isActive);
}

export function useRedditAccountActiveVault() {
  const { isAvailable, redditProvider } = useRedditProvider();
  return {
    ...useQuery({
      queryKey: ["RedditProvider", "AccountVaultAddresses"],
      queryFn: () => redditProvider.getAccountVaultAddresses(),
      select: activeVaultAddress,
      enabled: isAvailable,
    }),
    isRedditAvailable: isAvailable,
  };
}
