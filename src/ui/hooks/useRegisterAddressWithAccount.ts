import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Hex, hashTypedData, isAddressEqual } from "viem";

import { assert } from "../../assert";
import { log } from "../../logging";
import { RedditProviderError } from "../../reddit/reddit-interaction-client";
import { ErrorCode } from "../../reddit/reddit-interaction-spec";
import {
  NormalisedRedditEIP712Challenge,
  isExpired,
  verifySignedRedditChallenge,
} from "../../signing";
import { PairingId, SentPairingMessage } from "../state/createVaultonomyStore";
import { usePairingState } from "../state/usePairingState";
import { useVaultonomyStoreSingle } from "../state/useVaultonomyStore";
import { getRedditAccountVaultsQueryKey } from "./useRedditAccountVaults";
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
  const stats = useVaultonomyStoreSingle((s) => s.stats);
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
        session: { userId: pairingId.userId },
      });

      return { result: "ok", value: { messageHash: verification.hash } };
    },
    onSuccess(value: SentPairingMessage) {
      if (value.result === "ok") {
        stats?.logEvent({ name: "VT_pairingMsgSubmit_completed" });
      } else {
        stats?.logEvent({
          name: "VT_pairingMsgSubmit_failed",
          params: { reason: value.error },
        });
      }
      // pin the current pairing so that it remains after this mutation changes
      // the active wallet address (which changes the automatic pairingId).
      setPinnedPairing(pairingId);

      updatePairingState({ sentPairingMessage: value });
      queryClient.invalidateQueries({
        queryKey: getRedditAccountVaultsQueryKey(pairingId.userId),
      });
    },
    onError(error) {
      log.error("useRegisterAddressWithAccount error:", error);

      const errorName =
        isApiError(error) ? "request-not-processed" : "request-failed";

      stats?.logEvent({
        name: "VT_pairingMsgSubmit_failed",
        params: { reason: errorName },
      });

      updatePairingState({
        sentPairingMessage: {
          result: "error",
          error: errorName,
        },
      });
    },
  });
}

function isApiError(error: Error): boolean {
  return (
    error instanceof RedditProviderError &&
    error.type === ErrorCode.REDDIT_API_UNSUCCESSFUL
  );
}
