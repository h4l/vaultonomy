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
import {
  PairingId,
  SignedPairingMessage,
} from "../state/createVaultonomyStore";
import { usePairingState } from "../state/usePairingState";
import { useVaultonomyStore } from "../state/useVaultonomyStore";

type OwnershipChallengeSigningErrorOptions = {
  address: Address;
  challenge: NormalisedRedditEIP712Challenge;
  elapsedTimeMs: number;
  message: string;
} & ErrorOptions;

class BadWalletBehaviourError extends VaultonomyError {}
class OwnershipChallengeSigningError extends VaultonomyError {
  address: Address;
  challenge: NormalisedRedditEIP712Challenge;
  elapsedTimeMs: number;

  constructor({
    address,
    challenge,
    elapsedTimeMs,
    message,
    ...superOptions
  }: OwnershipChallengeSigningErrorOptions) {
    super(message, superOptions);
    this.address = address;
    this.challenge = challenge;
    this.elapsedTimeMs = elapsedTimeMs;
  }

  get isUserCancellation() {
    return this.isRejectedRequest && !this.isAutomaticCancellation;
  }

  get isAutomaticCancellation() {
    // Consider cancels within 1s to be automatic wallet cancels. e.g. Ledger
    // auto-cancels signature requests in the same way as if the user had
    // cancelled.
    return this.isRejectedRequest && this.elapsedTimeMs < 1000;
  }

  get isRejectedRequest() {
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
  pairingId,
  address,
  challenge,
}: {
  pairingId: PairingId;
  address: Address;
  challenge: NormalisedRedditEIP712Challenge;
}) {
  const config = useConfig();
  // const updatePairingState = useVaultonomyStore((s) => s.updateUser(userId));
  const { updatePairingState } = usePairingState(pairingId);

  return useMutation({
    mutationKey: [
      "SignAddressOwnershipChallenge",
      pairingId,
      address,
      hashTypedData(challenge),
    ],
    mutationFn: async () => {
      let signature: Hex;
      const startTimeMs = Date.now();
      let elapsedTimeMs: number;
      try {
        signature = await signTypedData(config, challenge);
        elapsedTimeMs = Date.now() - startTimeMs;

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
        elapsedTimeMs = Date.now() - startTimeMs;
        const cause = e as SignTypedDataErrorType;
        throw new SignFailedOwnershipChallengeSigningError({
          address,
          challenge,
          elapsedTimeMs,
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
        elapsedTimeMs,
        message: verification.reasonShort,
      });
    },
    onSuccess(value) {
      updatePairingState({ signedPairingMessage: { result: "ok", value } });
    },
    onError(cause) {
      log.error("useSignAddressOwnershipChallenge error:", cause);
      let error: NonNullable<SignedPairingMessage["error"]>;
      if (
        cause instanceof OwnershipChallengeSigningError &&
        cause.isUserCancellation
      )
        error = "user-cancelled";
      else if (
        cause instanceof OwnershipChallengeSigningError &&
        cause.isAutomaticCancellation
      ) {
        error = "wallet-cancelled";
      } else if (cause instanceof InvalidSigOwnershipChallengeSigError)
        error = "signature-invalid";
      else error = "sign-failed";

      updatePairingState({ signedPairingMessage: { result: "error", error } });
    },
  });
}
