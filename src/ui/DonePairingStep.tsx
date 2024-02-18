import { ReactNode } from "react";
import { UseAccountReturnType } from "wagmi";

import { Button } from "./Button";
import { EthInput, VaultonomyCard } from "./Card";
import { Link } from "./Link";
import { UseRedditAccountResult } from "./hooks/useRedditAccount";
import {
  PairingStep,
  PairingStepState,
  StepBody,
} from "./pairing-steps/components";
import { PairingId } from "./state/createVaultonomyStore";
import { usePairingState } from "./state/usePairingState";

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
  return (
    <StepBody className="grid md:grid-cols-[1fr_1fr] gap-y-6 _md:gap-y-0 md:gap-x-4 mb-6">
      <p className="_mb-6 md:col-span-2">
        Nice job, Reddit longer has access to your seed phrase. To celebrate
        your <em className="">Vault's autonomy</em> you can mint a commemorative
        Vaultonomy Card for your Reddit username. Use your card to show you
        value the security and principle of controlling your own Wallet.
      </p>

      <aside
        aria-label="Vaultonomy Card"
        className="flex flex-col gap-4 justify-between"
      >
        <div>
          {/* <Heading level={4} className="mt-4">
      Vaultonomy Card
    </Heading> */}
          <ul className="list-disc ml-4 text-sm">
            <li className="my-2">
              Your card will be displayed on:
              <ul className="list-disc ml-4">
                <li>
                  <Link href="https://vaultonomy.eth.link/cards">
                    vaultonomy.eth/cards
                  </Link>
                </li>
                <li>Your Wallet as an NFT</li>
              </ul>
            </li>
            <li className="my-2">
              Pay what you like — your card's number is its rank by price,
              updated in real time. Proceeds go to Vaultonomy development.
            </li>
            {/* <li>A bespoke on-chain NFT</li>
      <li>
        This is <strong>not</strong> a Reddit Avatar.
      </li> */}
          </ul>
        </div>

        <div>
          <EthInput />
          <Button
            size="l"
            className="my-4 mb-[0.8rem] sm:w-full justify-self-end"
          >
            Mint
          </Button>
        </div>
      </aside>
      <VaultonomyCard
        className={[
          "self-center justify-self-center",
          "row-start-2 md:row-start-auto",
          "w-64 md:w-full",
        ].join(" ")}
      />
    </StepBody>
  );
}
