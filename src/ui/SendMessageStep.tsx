import { ReactNode, useMemo } from "react";
import { hashTypedData } from "viem";

import { NormalisedRedditEIP712Challenge } from "../signing";
import { HexString, RequiredNonNullable } from "../types";
import { Button } from "./Button";
import { IndeterminateProgressBar } from "./IndeterminateProgressBar";
import { useRegisterAddressWithAccount } from "./hooks/useRegisterAddressWithAccount";
import {
  PairingStep,
  PairingStepState,
  StepAction,
  StepBody,
} from "./pairing-steps/components";
import {
  RedditErrorStepAction,
  SignatureInvalidError,
} from "./pairing-steps/steps";
import { PairingId, SentPairingMessage } from "./state/createVaultonomyStore";
import { usePairingState } from "./state/usePairingState";

function ThisStep({
  state,
  children,
}: {
  state: PairingStepState;
  children?: ReactNode;
}) {
  return (
    // <PairingStep num={3} name="Submit Pairing Message" state={state}>
    <PairingStep num={4} name="Go!" state={state}>
      {children}
    </PairingStep>
  );
}

export type SendMessageStepParams = {
  pairingId: PairingId | undefined;
  challenge: NormalisedRedditEIP712Challenge | undefined;
};

export function SendMessageStep({
  pairingId,
  challenge,
}: SendMessageStepParams): JSX.Element {
  const { signedPairingMessage, sentPairingMessage } = usePairingState(
    pairingId,
    ({ pairing }) => ({
      signedPairingMessage: pairing.signedPairingMessage,
      sentPairingMessage: pairing.sentPairingMessage,
    }),
  );

  if (
    pairingId === undefined ||
    challenge === undefined ||
    !signedPairingMessage?.value
  ) {
    return <ThisStep state="future" />;
  }

  return (
    <SendMessage
      pairingId={pairingId}
      signedPairingMessage={signedPairingMessage.value}
      sentPairingMessage={sentPairingMessage}
      challenge={challenge}
    />
  );
}

type SendMessageParams = RequiredNonNullable<SendMessageStepParams> & {
  signedPairingMessage: HexString;
  sentPairingMessage: SentPairingMessage | null;
};

function SendMessage({
  pairingId,
  signedPairingMessage,
  sentPairingMessage,
  challenge,
}: SendMessageParams): JSX.Element {
  const registerAddressWithAccount = useRegisterAddressWithAccount({
    pairingId,
    challenge,
    challengeSignature: signedPairingMessage,
  });

  const challengeHash = useMemo(() => hashTypedData(challenge), [challenge]);
  if (sentPairingMessage?.value?.messageHash === challengeHash) {
    return (
      <ThisStep state="past">
        <StepAction
          state="done"
          headline="Wallet paired as Vault"
          // headline="Pairing Message delivered"
          // details={<>Wallet is paired as your Vault</>}
        />
      </ThisStep>
    );
  }

  return (
    <ThisStep state="present">
      <StepBody>
        <p>This is it, you're all set.</p>
        <Button
          disabled={
            registerAddressWithAccount.status !== "idle" &&
            // allow retrying failed requests
            sentPairingMessage?.error !== "request-failed" &&
            sentPairingMessage?.error !== "request-not-processed"
          }
          size="l"
          className="relative block m-4"
          onClick={() => registerAddressWithAccount.mutate()}
        >
          Pair Wallet as Vault
          {registerAddressWithAccount.status === "pending" ?
            <div className="absolute bottom-0 left-0 w-full">
              <IndeterminateProgressBar />
            </div>
          : undefined}
        </Button>
      </StepBody>

      {registerAddressWithAccount.status === "pending" && (
        <StepAction state="pending" headline="Submitting Pairing Message…" />
      )}

      {sentPairingMessage?.error === "message-expired" && (
        <StepAction
          state="error"
          headline="The Pairing Message has expired."
          details={
            <>
              <p className="my-4">
                The Pairing Message you signed is no longer valid as it's too
                old (they only last a few minutes). You need to go back and sign
                a new one, sorry!
              </p>
            </>
          }
        />
      )}
      {sentPairingMessage?.error === "request-not-processed" && (
        <StepAction
          state="error"
          headline="Reddit could not pair your Wallet's Address."
          details={
            <>
              Although your Pairing Message appears valid, Reddit did not
              process it successfully.
              <ul className="list-outside list-disc ml-6">
                <li>
                  <strong>
                    Is this Address already paired with another Reddit account?
                  </strong>
                </li>
                <li>
                  Reddit won't allow an Address to be paired with multiple
                  accounts at the same time.
                </li>
                <li>
                  Reddit could be having a temporary glitch — you can try again
                  later.
                </li>
              </ul>
            </>
          }
        />
      )}
      {sentPairingMessage?.error === "request-failed" && (
        <RedditErrorStepAction while="submitting your Pairing Message" />
      )}
      {sentPairingMessage?.error === "signature-invalid" && (
        // in practice this shouldn't happen because it'll be caught in the signing step
        <SignatureInvalidError />
      )}
      {sentPairingMessage?.error && (
        <ResetPairingMessageButton pairingId={pairingId} />
      )}
      {/* <StepAction state="pending">Message sent</StepAction>
       */}
    </ThisStep>
  );
}

function ResetPairingMessageButton({ pairingId }: { pairingId: PairingId }) {
  const { updatePairingState } = usePairingState(pairingId);
  const goBack = () => {
    updatePairingState({
      fetchedPairingMessage: null,
      signedPairingMessage: null,
      sentPairingMessage: null,
    });
  };
  return (
    <StepBody>
      <Button size="l" onClick={goBack}>
        Go Back, Start Again
      </Button>
    </StepBody>
  );
}
