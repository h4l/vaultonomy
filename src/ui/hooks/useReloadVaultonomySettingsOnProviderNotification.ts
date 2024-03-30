import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { log } from "../../logging";
import { useVaultonomyStoreSingle } from "../state/useVaultonomyStore";
import { getVaultonomySettingsQueryKey } from "./useVaultonomySettings";

export function useReloadSettingsOnProviderNofication() {
  const queryClient = useQueryClient();
  const provider = useVaultonomyStoreSingle((s) => s.provider);

  useEffect(() => {
    const stop = provider?.emitter.on("settingsChanged", () => {
      log.debug("settingsChanged: settings query invalidated");
      queryClient.invalidateQueries({
        queryKey: getVaultonomySettingsQueryKey(),
      });
    });
    return stop;
  }, [provider]);
}
