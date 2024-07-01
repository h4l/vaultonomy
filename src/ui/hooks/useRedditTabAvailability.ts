import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { assert } from "../../assert";
import { RedditTabAvailability } from "../../vaultonomy-rpc-spec";
import { VaultonomyBackgroundProvider } from "../rpc/VaultonomyBackgroundProvider";
import { useVaultonomyStoreSingle } from "../state/useVaultonomyStore";

export function getRedditTabAvailabilityQueryKey() {
  return ["VaultonomyBackgroundProvider", "RedditTabAvailability"];
}

export function getRedditTabAvailabilityQueryOptions({
  provider,
}: {
  provider: VaultonomyBackgroundProvider | null;
}) {
  return queryOptions<RedditTabAvailability>({
    queryKey: getRedditTabAvailabilityQueryKey(),
    async queryFn() {
      assert(provider, "queryFn called when not enabled");
      return await provider.getRedditTabAvailability();
    },
    enabled: !!provider,
  });
}

export function useRedditTabAvailability() {
  const provider = useVaultonomyStoreSingle((s) => s.provider);
  return useQuery(getRedditTabAvailabilityQueryOptions({ provider }));
}

/**
 * Monitor a VaultonomyBackgroundProvider for Reddit tab availability changes,
 * and update the useRedditTabAvailability query to match.
 */
export function useSyncRedditTabAvailabilityWithProviderNotifications() {
  const queryClient = useQueryClient();
  const provider = useVaultonomyStoreSingle((s) => s.provider);

  useEffect(() => {
    const stop = provider?.emitter.on("availabilityStatus", (event) => {
      queryClient.setQueryData(getRedditTabAvailabilityQueryKey(), {
        available: event.type === "redditTabBecameAvailable",
      });
    });
    return stop;
  }, [provider]);
}
