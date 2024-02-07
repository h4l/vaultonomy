import { useMutation } from "@tanstack/react-query";

import { assert } from "../../assert";
import { log } from "../../logging";
import { useVaultonomyStore } from "../state/useVaultonomyStore";
import { useRedditProvider } from "./useRedditProvider";

type CreateAddressOwnershipChallengeOptions = {
  userId: string;
  address: `0x${string}`;
};
export function useCreateAddressOwnershipChallenge({
  userId,
  address,
}: CreateAddressOwnershipChallengeOptions) {
  const { redditProvider } = useRedditProvider();
  const updateUser = useVaultonomyStore((s) => s.updateUser(userId));

  return {
    ...useMutation({
      mutationKey: ["RedditProvider", "createAddressOwnershipChallenge"],
      mutationFn: async () => {
        return await redditProvider.createAddressOwnershipChallenge({
          // FIXME: include userId in request to detect change of user session on Reddit side.
          // userId,
          address,
        });
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
    }),
  };
}
