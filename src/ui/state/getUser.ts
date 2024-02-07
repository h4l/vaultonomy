import {
  UserState,
  VaultonomyStateData,
  emptyUser,
} from "./createVaultonomyStore";

export function getUser(
  store: VaultonomyStateData,
  userId: string | undefined,
  default_?: () => UserState,
): UserState;
export function getUser<T>(
  store: VaultonomyStateData,
  userId: string | undefined,
  default_: () => T,
): UserState | T;
export function getUser<T>(
  store: VaultonomyStateData,
  userId: string | undefined,
  default_?: () => T,
): UserState | T {
  if (default_ === undefined) default_ = emptyUser as () => T;
  return (userId ? store.users[userId] : undefined) ?? default_();
}
