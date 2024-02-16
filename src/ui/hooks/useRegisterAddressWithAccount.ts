import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Hex, hashTypedData, isAddressEqual } from "viem";

import { assert } from "../../assert";
import { log } from "../../logging";
import {
  NormalisedRedditEIP712Challenge,
  isExpired,
  verifySignedRedditChallenge,
} from "../../signing";
import { PairingId, SentPairingMessage } from "../state/createVaultonomyStore";
import { usePairingState } from "../state/usePairingState";
import { getRedditAccountActiveVaultQueryKey } from "./useRedditAccountActiveVault";
import { assumeAvailable, useRedditProvider } from "./useRedditProvider";

type RegisterAddressWithAccountOptions = {
  pairingId: PairingId;
  challenge: NormalisedRedditEIP712Challenge;
  challengeSignature: Hex;
};
export function useRegisterAddressWithAccount({
  pairingId,
  challenge,
  challengeSignature,
}: RegisterAddressWithAccountOptions) {
  const queryClient = useQueryClient();
  const { redditProvider } = useRedditProvider();
  const { setPinnedPairing, updatePairingState } = usePairingState(
    pairingId,
    ({ state }) => ({
      setPinnedPairing: state.setPinnedPairing,
      updatePairingState: state.updatePairingState(pairingId),
    }),
  );

  const challengeKey = useMemo(() => hashTypedData(challenge), [challenge]);

  return useMutation({
    mutationKey: [
      "RedditProvider",
      "registerAddressWithAccount",
      pairingId,
      challengeKey,
    ],
    mutationFn: async (): Promise<SentPairingMessage> => {
      // Should never happen assuming the UI manages state correctly.
      assert(
        isAddressEqual(pairingId.walletAddress, challenge.message.address),
        "Pairing Message contains a different address to the connected wallet",
      );

      if (isExpired(challenge)) {
        return { result: "error", error: "message-expired" };
      }

      const verification = await verifySignedRedditChallenge({
        challenge,
        signature: challengeSignature,
      });

      if (!verification.isValid) {
        return { result: "error", error: "signature-invalid" };
      }

      await assumeAvailable(redditProvider).registerAddressWithAccount({
        address: challenge.message.address,
        challengeSignature,
        userId: pairingId.userId,
      });

      return { result: "ok", value: { messageHash: verification.hash } };
    },
    onSuccess(value: SentPairingMessage) {
      // pin the current pairing so that it remains after this mutation changes
      // the active wallet address (which changes the automatic pairingId).
      setPinnedPairing(pairingId);

      updatePairingState({ sentPairingMessage: value });
      queryClient.invalidateQueries({
        queryKey: getRedditAccountActiveVaultQueryKey(pairingId.userId),
      });
    },
    onError(error) {
      log.error("useRegisterAddressWithAccount error:", error);
      updatePairingState({
        sentPairingMessage: { result: "error", error: "request-failed" },
      });
    },
  });
}
