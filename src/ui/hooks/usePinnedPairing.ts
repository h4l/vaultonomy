import {
  PairingId,
  PairingState,
  encodePairingStateKey,
} from "../state/createVaultonomyStore";
import { useVaultonomyStore } from "../state/useVaultonomyStore";

export type PinnedPairingResult =
  | { pinnedPairingId: null; pinnedPairing: null }
  | { pinnedPairingId: PairingId; pinnedPairing: PairingState };

export function usePinnedPairing() {
  const [pinnedPairingId, pinnedPairing] = useVaultonomyStore((s) => [
    s.pinnedPairing,
    s.pinnedPairing ?
      s.pairings[encodePairingStateKey(s.pinnedPairing)]
    : undefined,
  ]);
  // pinned pairings are only valid when their state is fully populated
  if (
    pinnedPairingId &&
    pinnedPairing &&
    pinnedPairing.sentPairingMessage?.value
  ) {
    return { pinnedPairingId, pinnedPairing };
  }
  return { pinnedPairingId: null, pinnedPairing: null };
}
