import {
  PairingId,
  PairingState,
  UpdatePairingStateFunction,
  VaultonomyState,
} from "./createVaultonomyStore";
import { getPairingState } from "./getPairingState";
import { useVaultonomyStore } from "./useVaultonomyStore";

export function getPairingId({
  userId,
  vaultAddress,
  walletAddress,
}: Partial<PairingId>): PairingId | undefined {
  if (userId && walletAddress && vaultAddress !== undefined)
    return { userId, vaultAddress, walletAddress };
  return undefined;
}

type Selector<T> = (options: {
  id: PairingId | undefined;
  pairing: PairingState;
  s: VaultonomyState;
  state: VaultonomyState;
}) => T;

type DefaultSelectorResult = { pairing: PairingState };
const defaultSelector: Selector<DefaultSelectorResult> = ({ pairing }) => ({
  pairing,
});

type UpdatePairingStateResult<T extends PairingId | undefined> =
  T extends undefined ? { updatePairingState: undefined }
  : { updatePairingState: UpdatePairingStateFunction };

export function usePairingState<ID extends PairingId | undefined>(
  id: ID,
): UpdatePairingStateResult<ID> & DefaultSelectorResult;

export function usePairingState<T, ID extends PairingId | undefined>(
  id: ID,
  selector: Selector<T>,
): UpdatePairingStateResult<ID> & T;

export function usePairingState<T, ID extends PairingId | undefined>(
  id_: ID,
  selector_?: Selector<T>,
): UpdatePairingStateResult<ID> & T {
  const selector = selector_ || (defaultSelector as Selector<T>);

  return useVaultonomyStore((s) => {
    let id: PairingId | undefined = id_ && getPairingId(id_);
    const updatePairingState = id ? s.updatePairingState(id) : undefined;
    return {
      updatePairingState,
      ...selector({ id, pairing: getPairingState(id, s), s, state: s }),
    };
  }) as UpdatePairingStateResult<ID> & T;
}
