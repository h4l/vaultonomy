import { useMutation } from "@tanstack/react-query";

import { log } from "../../logging";
import { validateRedditChallenge } from "../../signing";
import { PairingId } from "../state/createVaultonomyStore";
import { usePairingState } from "../state/usePairingState";
import {
  RedditNotConnectedError,
  assumeAvailable,
  useRedditProvider,
} from "./useRedditProvider";

type CreateAddressOwnershipChallengeOptions = {
  pairingId: PairingId;
  redditUserName: string;
  address: `0x${string}`;
};
export function useCreateAddressOwnershipChallenge({
  pairingId,
  redditUserName,
  address,
}: CreateAddressOwnershipChallengeOptions) {
  const { redditProvider } = useRedditProvider();
  const { updatePairingState } = usePairingState(pairingId);

  return useMutation({
    mutationKey: [
      "RedditProvider",
      "createAddressOwnershipChallenge",
      pairingId,
      redditUserName,
      address,
    ],
    mutationFn: async () => {
      const challenge = await assumeAvailable(
        redditProvider,
      ).createAddressOwnershipChallenge({
        userId: pairingId.userId,
        address,
      });

      validateRedditChallenge({ address, challenge, redditUserName });
      return challenge;
    },
    onSuccess(value) {
      updatePairingState({ fetchedPairingMessage: { result: "ok", value } });
    },
    onError(error) {
      log.error("useCreateAddressOwnershipChallenge error:", error);
      updatePairingState({
        fetchedPairingMessage: { result: "error", error: null },
      });
    },
  });
}
