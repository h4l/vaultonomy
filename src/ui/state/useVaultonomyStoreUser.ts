import { UserState, VaultonomyState } from "./createVaultonomyStore";
import { getUser } from "./getUser";
import { useVaultonomyStore } from "./useVaultonomyStore";

export function useVaultonomyStoreUser<T>(
  userId: string | undefined,
  selector: (options: {
    user: UserState;
    s: VaultonomyState;
    state: VaultonomyState;
  }) => T,
): T {
  return useVaultonomyStore((s) =>
    selector({ user: getUser(s, userId), s, state: s }),
  );
}
