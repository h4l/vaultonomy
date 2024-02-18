import { QueryKey, UseQueryOptions, useQuery } from "@tanstack/react-query";

import { assert } from "../../assert";
import { log } from "../../logging";
import { AccountVaultAddress } from "../../reddit/api-client";
import { RedditProvider } from "../../reddit/reddit-interaction-client";
import { assumeAvailable, useRedditProvider } from "./useRedditProvider";

type QueryData = ReadonlyArray<AccountVaultAddress>;

export type VaultAddresses = {
  activeVault: AccountVaultAddress | null;
  pastVaults: ReadonlyArray<AccountVaultAddress>;
};

function sortVaultsByCreationNewestFirst(vaults: AccountVaultAddress[]): void {
  vaults.sort((a, b) => a.createdAt - b.createdAt);
}

function selectGroupedVaultAddresses(
  vaultAddresses: QueryData,
): VaultAddresses {
  let activeVault: AccountVaultAddress | null = null;
  const pastVaults: AccountVaultAddress[] = [];
  for (const v of vaultAddresses) {
    if (v.isActive && activeVault)
      log.warn("More than one Vault is marked active", activeVault, v);

    if (!activeVault && v.isActive) activeVault = v;
    else pastVaults.push(v);
  }

  sortVaultsByCreationNewestFirst(pastVaults);
  return { activeVault, pastVaults };
}

function selectActiveVaultAddress(
  vaultAddresses?: QueryData,
): AccountVaultAddress | null {
  return vaultAddresses?.find((va) => va.isActive) ?? null;
}

export function getRedditAccountVaultsQueryKey(
  userId: string | unknown,
): QueryKey {
  return ["RedditProvider", "AccountVaultAddresses", userId];
}

function getRedditAccountVaultsQuery(
  userId: string | undefined,
  redditProvider: RedditProvider | null,
) {
  return {
    queryKey: getRedditAccountVaultsQueryKey(userId),
    queryFn: () => {
      assert(userId !== undefined);
      return assumeAvailable(redditProvider).getAccountVaultAddresses({
        userId,
      });
    },
    enabled: redditProvider !== null && userId !== undefined,
  } as const satisfies UseQueryOptions<ReadonlyArray<AccountVaultAddress>>;
}

function useRedditAccountVaultsRaw<TData>({
  userId,
  select,
}: {
  userId: string | undefined;
  select: (data: QueryData) => TData;
}) {
  const { isAvailable, redditProvider } = useRedditProvider();
  return {
    ...useQuery({
      ...getRedditAccountVaultsQuery(userId, redditProvider),
      select,
    }),
    isRedditAvailable: isAvailable,
  };
}

export type UseRedditAccountVaultsResult = ReturnType<
  typeof useRedditAccountVaults
>;
export function useRedditAccountVaults({
  userId,
}: {
  userId: string | undefined;
}) {
  return useRedditAccountVaultsRaw({
    userId,
    select: selectGroupedVaultAddresses,
  });
}

export type UseRedditAccountActiveVaultResult = ReturnType<
  typeof useRedditAccountActiveVault
>;
export function useRedditAccountActiveVault({
  userId,
}: {
  userId: string | undefined;
}) {
  return useRedditAccountVaultsRaw({
    userId,
    select: selectActiveVaultAddress,
  });
}
