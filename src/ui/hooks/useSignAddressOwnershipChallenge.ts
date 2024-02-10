import { useMutation } from "@tanstack/react-query";
import {
  Address,
  Hex,
  ProviderRpcErrorType,
  UserRejectedRequestError,
  hashTypedData,
} from "viem";
import { useConfig } from "wagmi";
import { SignTypedDataErrorType, signTypedData } from "wagmi/actions";

import { VaultonomyError } from "../../VaultonomyError";
import { log } from "../../logging";
import {
  NormalisedRedditEIP712Challenge,
  verifySignedRedditChallenge,
} from "../../signing";
import { SignedPairingMessage } from "../state/createVaultonomyStore";
import { useVaultonomyStore } from "../state/useVaultonomyStore";

type OwnershipChallengeSigningErrorOptions = {
  address: Address;
  challenge: NormalisedRedditEIP712Challenge;
  message: string;
} & ErrorOptions;

class BadWalletBehaviourError extends VaultonomyError {}
class OwnershipChallengeSigningError extends VaultonomyError {
  address: Address;
  challenge: NormalisedRedditEIP712Challenge;

  constructor({
    address,
    challenge,
    message,
    ...superOptions
  }: OwnershipChallengeSigningErrorOptions) {
    super(message, superOptions);
    this.address = address;
    this.challenge = challenge;
  }

  get isUserCancellation() {
    return (
      typeof this.cause === "object" &&
      (this.cause as Record<string, unknown>)?.name ===
        "UserRejectedRequestError"
    );
  }
}

class SignFailedOwnershipChallengeSigningError extends OwnershipChallengeSigningError {
  cause: SignTypedDataErrorType;
  constructor(
    options: OwnershipChallengeSigningErrorOptions & {
      cause: SignTypedDataErrorType;
    },
  ) {
    super(options);
    this.cause = options.cause;
  }
}

class InvalidSigOwnershipChallengeSigError extends OwnershipChallengeSigningError {
  signature: Hex;
  constructor({
    signature,
    ...superOptions
  }: OwnershipChallengeSigningErrorOptions & { signature: Hex }) {
    super(superOptions);
    this.signature = signature;
  }
}

export function useSignAddressOwnershipChallenge({
  userId,
  address,
  challenge,
}: {
  userId: string;
  address: Address;
  challenge: NormalisedRedditEIP712Challenge;
}) {
  const config = useConfig();
  const updateUser = useVaultonomyStore((s) => s.updateUser(userId));

  return useMutation({
    mutationKey: [
      "SignAddressOwnershipChallenge",
      userId,
      address,
      hashTypedData(challenge),
    ],
    mutationFn: async () => {
      let signature: Hex;
      try {
        signature = await signTypedData(config, challenge);

        // Rainbow wallet returns the string "null" when the user cancels the sign
        // request, instead of sending a user cancelation error.
        if (!signature || (signature as string) === "null") {
          throw new UserRejectedRequestError(
            new BadWalletBehaviourError(
              "signTypedData() request returned empty value",
            ),
          );
        }
      } catch (e) {
        const cause = e as SignTypedDataErrorType;
        throw new SignFailedOwnershipChallengeSigningError({
          address,
          challenge,
          message: "Signing request to Wallet failed",
          cause,
        });
      }
      // TODO: Rainbow wallet returns the string "null" when the user cancels the sign request
      // TODO: Ledger Live rejects the request immediately as if the user had cancelled. This
      //       is because it requires a metadata file to describe EIP-712 sigs before it'll
      //       sign them.

      const verification = await verifySignedRedditChallenge({
        challenge,
        signature,
        expectedAddress: address,
      });
      if (verification.isValid) return signature;

      throw new InvalidSigOwnershipChallengeSigError({
        signature,
        address,
        challenge,
        message: verification.reasonShort,
      });
    },
    onSuccess(value) {
      updateUser({ signedPairingMessage: { result: "ok", value } });
    },
    onError(cause) {
      log.error("useSignAddressOwnershipChallenge error:", cause);
      let error: NonNullable<SignedPairingMessage["error"]>;
      if (
        cause instanceof OwnershipChallengeSigningError &&
        cause.isUserCancellation
      )
        error = "cancelled";
      else if (cause instanceof InvalidSigOwnershipChallengeSigError)
        error = "signature-invalid";
      else error = "sign-failed";

      updateUser({ signedPairingMessage: { result: "error", error } });
    },
  });
}
