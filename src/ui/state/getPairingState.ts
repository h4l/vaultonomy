import {
  PairingId,
  PairingState,
  VaultonomyStateData,
  emptyPairingState,
  encodePairingStateKey,
} from "./createVaultonomyStore";

export function getPairingState(
  id: PairingId | undefined,
  store: VaultonomyStateData,
  default_?: () => PairingState,
): PairingState;
export function getPairingState<T>(
  id: PairingId | undefined,
  store: VaultonomyStateData,
  default_: () => T,
): PairingState | T;
export function getPairingState<T>(
  pairingId: PairingId | undefined,
  store: VaultonomyStateData,
  default_?: () => T,
): PairingState | T {
  if (default_ === undefined) default_ = emptyPairingState as () => T;
  const key = pairingId ? encodePairingStateKey(pairingId) : undefined;
  return (key ? store.pairings[key] : undefined) ?? default_();
}
