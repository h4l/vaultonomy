import { useVaultonomyStore } from "../ui/state/useVaultonomyStore";

export function useIsOnDevServer(): boolean {
  return useVaultonomyStore((s) => s.isOnDevServer);
}
