import { ReactNode } from "react";
import { UseAccountReturnType } from "wagmi";

import { Button } from "./Button";
import { UseRedditAccountResult } from "./hooks/useRedditAccount";
import {
  PairingStep,
  PairingStepState,
  StepBody,
} from "./pairing-steps/components";
import { PairingId } from "./state/createVaultonomyStore";
import { usePairingState } from "./state/usePairingState";
import { useVaultonomyStore } from "./state/useVaultonomyStore";

function ThisStep({
  state,
  children,
}: {
  state: PairingStepState;
  children?: ReactNode;
}) {
  return (
    <PairingStep num={5} name="Done" state={state}>
      {children}
    </PairingStep>
  );
}

export type DonePairingStepParams = {
  pairingId: PairingId | undefined;
  redditAccount: UseRedditAccountResult;
  wallet: UseAccountReturnType;
};

export function DonePairingStep({
  pairingId,
  wallet,
  redditAccount,
}: DonePairingStepParams): JSX.Element {
  const { sentPairingMessage } = usePairingState(pairingId, ({ pairing }) => ({
    sentPairingMessage: pairing.sentPairingMessage,
  }));

  if (
    !wallet.isConnected ||
    !redditAccount.isRedditAvailable ||
    !sentPairingMessage?.value
  ) {
    return <ThisStep state="future" />;
  }

  return (
    <ThisStep state="present">
      <DonePairing />
    </ThisStep>
  );
}

// type DonePairingParams = RequiredNonNullable<DonePairingStepParams>;

export function DonePairing(): JSX.Element {
  const setPinnedPairing = useVaultonomyStore((s) => s.setPinnedPairing);

  return (
    <StepBody className="flex flex-col gap-y-4 mb-6">
      <p className="">
        Nice job, Reddit longer has access to your seed phrase.
      </p>
      <p>
        Recommend Vaultonomy to a friend and leave a rating or review if you
        like it.
      </p>
      <p>
        <Button
          size="l"
          className="my-4 mb-[0.8rem] sm:w-full justify-self-end"
          onClick={() => setPinnedPairing(null)}
        >
          Start Again
        </Button>
      </p>
      <p>
        We have plans for commemorative collectables, so keep an eye out and
        check back later.
      </p>
    </StepBody>
  );
}
