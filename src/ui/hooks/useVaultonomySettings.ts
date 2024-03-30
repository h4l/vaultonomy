import { useQuery } from "@tanstack/react-query";

import { assert } from "../../assert";
import { VaultonomySettings } from "../../vaultonomy-rpc-spec";
import { useVaultonomyStore } from "../state/useVaultonomyStore";

export function useVaultonomySettings<T>({
  select,
}: {
  select: (settings: VaultonomySettings) => T;
}) {
  const provider = useVaultonomyStore((s) => s.provider);
  return useQuery({
    queryKey: ["VaultonomyBackgroundProvider", "getSettings"],
    queryFn: async () => {
      assert(provider, "query executed when not enabled");
      return await provider.getSettings();
    },
    select,
    enabled: provider !== null,
  });
}
