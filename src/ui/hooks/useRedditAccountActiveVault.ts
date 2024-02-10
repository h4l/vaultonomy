import { useQuery } from "@tanstack/react-query";

import { assert } from "../../assert";
import { AccountVaultAddress } from "../../reddit/api-client";
import { useRedditProvider } from "./useRedditProvider";

function activeVaultAddress(
  vaultAddresses?: ReadonlyArray<AccountVaultAddress>,
): AccountVaultAddress | undefined {
  return vaultAddresses?.find((va) => va.isActive);
}

export type RedditAccountActiveVaultResult = ReturnType<
  typeof useRedditAccountActiveVault
>;
export function useRedditAccountActiveVault({
  userId,
}: {
  userId: string | undefined;
}) {
  const { isAvailable, redditProvider } = useRedditProvider();
  return {
    ...useQuery({
      queryKey: ["RedditProvider", "AccountVaultAddresses", userId],
      queryFn: () => {
        assert(userId !== undefined);
        return redditProvider.getAccountVaultAddresses({ userId });
      },
      select: activeVaultAddress,
      enabled: isAvailable && userId !== undefined,
    }),
    isRedditAvailable: isAvailable,
  };
}
