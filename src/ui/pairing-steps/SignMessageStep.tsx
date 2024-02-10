import { error } from "loglevel";
import { ReactNode } from "react";
import { Address } from "viem";
import { useChainId, useSwitchChain } from "wagmi";

import { assert, assertUnreachable } from "../../assert";
import { NormalisedRedditEIP712Challenge } from "../../signing";
import { RequiredNonNullable } from "../../types";
import { Button } from "../Button";
import { Link } from "../Link";
import { usePairingMessage } from "../hooks/usePairingMessage";
import { useRedditAccount } from "../hooks/useRedditAccount";
import { useSignAddressOwnershipChallenge } from "../hooks/useSignAddressOwnershipChallenge";
import { PAIRING_MESSAGE, WALLET } from "../ids";
import {
  ResultError,
  SignedPairingMessage,
} from "../state/createVaultonomyStore";
import { useVaultonomyStore } from "../state/useVaultonomyStore";
import { useVaultonomyStoreUser } from "../state/useVaultonomyStoreUser";
import { PairingStepsInlineHelp } from "./PairingStepsInlineHelp";
import {
  PairingStep,
  PairingStepState,
  StepAction,
  StepBody,
} from "./components";
import { RedditErrorStepAction } from "./steps";

function ThisStep({
  state,
  children,
}: {
  state: PairingStepState;
  children?: ReactNode;
}) {
  return (
    <PairingStep num={3} name="Review & Sign Message" state={state}>
      {children}
    </PairingStep>
  );
}

export type SignMessageStepParams = {
  userId: string | undefined;
  address: Address | undefined;
  challenge: NormalisedRedditEIP712Challenge | undefined;
};

export function SignMessageStep({
  userId,
  address,
  challenge,
}: {
  userId: string | undefined;
  address: Address | undefined;
  challenge: NormalisedRedditEIP712Challenge | undefined;
}): JSX.Element {
  if (
    userId === undefined ||
    address === undefined ||
    challenge === undefined
  ) {
    return <ThisStep state="future" />;
  }

  return (
    <SignMessage userId={userId} address={address} challenge={challenge} />
  );
}

// type SignMessageParams = Required<SignMessageStepParams>

type SignMessageParams = RequiredNonNullable<SignMessageStepParams>;
function SignMessage({
  userId,
  address,
  challenge,
}: SignMessageParams): JSX.Element {
  const chainId = useChainId();
  const { chains, switchChain } = useSwitchChain();

  const { mutate, status, error } = useSignAddressOwnershipChallenge({
    userId,
    address,
    challenge,
  });
  const result = useVaultonomyStoreUser(
    userId,
    ({ user }) => user.signedPairingMessage,
  );

  if (status === "success" || result?.result === "ok") {
    return (
      <ThisStep state="past">
        <StepAction state="done" headline="Message signed" />
      </ThisStep>
    );
  }

  if (BigInt(chainId) !== challenge.domain.chainId) {
    return (
      <ThisStep state="present">
        <StepAction
          state="error"
          headline={`Incorrect chain ID ${chainId}`}
          details={
            <Button
              onClick={() =>
                switchChain({ chainId: Number(challenge.domain.chainId) })
              }
            >
              Switch Chain
            </Button>
          }
        />
      </ThisStep>
    );
  }

  return (
    <ThisStep state="present">
      <StepBody>
        <p className="mb-2">
          Sign{" "}
          <Link toId={PAIRING_MESSAGE}>Reddit's Vault Pairing Message</Link>{" "}
          with your Wallet to prove to Reddit that:
        </p>
        <ul className="list-disc ml-6 my-2">
          <li>
            <PairingStepsInlineHelp
              iconOffsetLeft="-2.15rem"
              helpText={
                "This stops a bad person pairing someone else's Wallet to their account."
              }
            >
              You own your Wallet's address.
            </PairingStepsInlineHelp>
          </li>
          <li>
            <PairingStepsInlineHelp
              iconOffsetLeft="-2.15rem"
              helpText={
                "The message expires after a few minutes, so your signature proves you are present right now."
              }
            >
              You wish to make it your Vault address.
            </PairingStepsInlineHelp>
          </li>
        </ul>
        <Button
          size="l"
          className="block m-4"
          disabled={status === "pending"}
          onClick={() => mutate()}
        >
          Sign Message
        </Button>
      </StepBody>
      {(status === "pending" || !result) && (
        <StepAction
          state="pending"
          headline="Awaiting signature from your Wallet…"
        />
      )}
      {/* TODO: need to consult stored error */}
      {!result?.error || result.error === "cancelled" ?
        undefined
      : <SignMessageError error={result.error} />}
    </ThisStep>
  );
}

function SignMessageError({
  error,
}: {
  error: "sign-failed" | "signature-invalid";
}): JSX.Element {
  if (error === "sign-failed") {
    return (
      <StepAction
        state="error"
        headline="Vaultonomy hit an error while requesting your Wallet to sign the Message"
      />
    );
  } else if (error === "signature-invalid") {
    return (
      <StepAction
        state="error"
        headline="The Message signature your Wallet provided is not correct"
        details={
          <>
            The signature doesn't match Reddit's Message and your Wallet
            address.
            <ul className="list-outside list-disc ml-6">
              <li>
                Is your Wallet showing the same <code>0x...</code> address as
                the <Link toId={WALLET}>Wallet</Link> section above? If not,
                reconnect your Wallet and try again.
              </li>
              <li>
                Did your Wallet show you the fields of{" "}
                <Link toId={PAIRING_MESSAGE}>Reddit's Message</Link>? If not,
                your Wallet may not support signing this type of structured
                data.
              </li>
            </ul>
          </>
        }
      />
    );
  }
  assertUnreachable(error);
}
