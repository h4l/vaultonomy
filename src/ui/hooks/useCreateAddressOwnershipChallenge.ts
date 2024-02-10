import { useMutation } from "@tanstack/react-query";

import { log } from "../../logging";
import { validateRedditChallenge } from "../../signing";
import { useVaultonomyStore } from "../state/useVaultonomyStore";
import { useRedditProvider } from "./useRedditProvider";

type CreateAddressOwnershipChallengeOptions = {
  userId: string;
  redditUserName: string;
  address: `0x${string}`;
};
export function useCreateAddressOwnershipChallenge({
  userId,
  redditUserName,
  address,
}: CreateAddressOwnershipChallengeOptions) {
  const { redditProvider } = useRedditProvider();
  const updateUser = useVaultonomyStore((s) => s.updateUser(userId));

  return useMutation({
    mutationKey: [
      "RedditProvider",
      "createAddressOwnershipChallenge",
      userId,
      redditUserName,
      address,
    ],
    mutationFn: async () => {
      const challenge = await redditProvider.createAddressOwnershipChallenge({
        userId,
        address,
      });

      validateRedditChallenge({ address, challenge, redditUserName });
      return challenge;
    },
    onSuccess(value) {
      updateUser({ fetchedPairingMessage: { result: "ok", value } });
    },
    onError(error) {
      log.error("useCreateAddressOwnershipChallenge error:", error);
      updateUser({
        fetchedPairingMessage: { result: "error", error: null },
      });
    },
  });
}
