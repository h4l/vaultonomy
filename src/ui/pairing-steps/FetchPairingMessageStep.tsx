import { FormEvent, ReactNode, useRef } from "react";
import { Address } from "viem";

import { assert } from "../../assert";
import { log } from "../../logging";
import { RequiredNonNullable } from "../../types";
import { Button } from "../Button";
import { Heading } from "../Heading";
import { IndeterminateProgressBar } from "../IndeterminateProgressBar";
import { Link } from "../Link";
import { InlineCheckBox } from "../forms/CheckBox";
import {
  UseCreateAddressOwnershipChallengeResult,
  useCreateAddressOwnershipChallenge,
} from "../hooks/useCreateAddressOwnershipChallenge";
import { UseRedditAccountActiveVaultResult } from "../hooks/useRedditAccountVaults";
import {
  FetchedPairingMessage,
  PairingChecklist,
  PairingId,
} from "../state/createVaultonomyStore";
import { usePairingState } from "../state/usePairingState";
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
    // <PairingStep num={2} name="Prepare Pairing Message" state={state}>
    <PairingStep num={2} name="Get Ready" state={state}>
      {children}
    </PairingStep>
  );
}

type FetchPairingMessageStepProps = {
  pairingId: PairingId | undefined;
  address: Address | undefined;
  redditUserName: string | undefined;
  activeVault: UseRedditAccountActiveVaultResult;
};

export function FetchPairingMessageStep({
  pairingId,
  address,
  redditUserName,
  activeVault,
}: FetchPairingMessageStepProps): JSX.Element {
  const { fetchedPairingMessage, startPairingAttemptsBlocked } =
    usePairingState(pairingId, ({ pairing }) => ({
      fetchedPairingMessage: pairing.fetchedPairingMessage,
      startPairingAttemptsBlocked: pairing.startPairingAttemptsBlocked,
    }));

  if (!pairingId || !redditUserName || !address) {
    // account & reddit errors handled by previous step
    return <ThisStep state="future" />;
  }

  if (activeVault.isError) {
    return (
      <ThisStep state="present">
        <RedditErrorStepAction while="getting your Vault details from Reddit" />
      </ThisStep>
    );
  }

  if (activeVault.isLoading) {
    return (
      <ThisStep state="present">
        <StepAction state="pending" headline="Getting your Vault details" />
      </ThisStep>
    );
  }

  if (fetchedPairingMessage?.value) {
    return (
      <>
        <ThisStep state="past">
          <CheckedVaultAction />
          <StepAction
            state="done"
            headline="Received Pairing Message from Reddit"
          />
        </ThisStep>
      </>
    );
  }

  return (
    <FetchPairingMessage
      activeVault={activeVault}
      address={address}
      fetchedPairingMessage={fetchedPairingMessage}
      pairingId={pairingId}
      redditUserName={redditUserName}
      startPairingAttemptsBlocked={startPairingAttemptsBlocked}
    />
  );
}

function CheckedVaultAction() {
  //TODO: should we include this confirmation? Seems unnecessary.
  return (
    <StepAction
      state="done"
      headline="Checked your Vault details"
      // details={
      //   hasActiveVault ?
      //     "Your account has an active Vault"
      //   : "Your account has no active Vault"
      // }
    />
  );
}

type FetchPairingMessageProps =
  RequiredNonNullable<FetchPairingMessageStepProps> & {
    fetchedPairingMessage: FetchedPairingMessage | null;
    startPairingAttemptsBlocked: number;
  };

function FetchPairingMessage({
  pairingId,
  address,
  redditUserName,
  activeVault,
  fetchedPairingMessage,
  startPairingAttemptsBlocked,
}: FetchPairingMessageProps): JSX.Element {
  const createAddressOwnershipChallenge = useCreateAddressOwnershipChallenge({
    pairingId,
    redditUserName,
    address,
  });
  const hasActiveVault = activeVault.data !== null;

  return (
    <ThisStep state="present">
      <CheckedVaultAction />
      <StepBody>
        <PairingStartPreamble hasActiveVault={hasActiveVault} />
        <StartPairingForm
          createAddressOwnershipChallenge={createAddressOwnershipChallenge}
          pairingId={pairingId}
          hasActiveVault={hasActiveVault}
        />
      </StepBody>

      {startPairingAttemptsBlocked > 0 ?
        <StepAction
          state="error"
          alertKey={`${startPairingAttemptsBlocked}`}
          headline={`Complete the Pre-Pairing Checklist`}
          details={blockedStartPairingDetails(startPairingAttemptsBlocked)}
        />
      : undefined}

      {fetchedPairingMessage?.error ?
        <RedditErrorStepAction while="asking Reddit to start pairing your Wallet" />
      : undefined}
      {createAddressOwnershipChallenge.status === "pending" ?
        <StepAction
          state="pending"
          headline="Asking Reddit to start pairing your Wallet…"
        />
      : undefined}
    </ThisStep>
  );
}

function PairingStartPreamble({
  hasActiveVault,
}: {
  hasActiveVault: boolean;
}): JSX.Element {
  if (hasActiveVault) {
    return (
      <PairingStepsInlineHelp
        helpId="pairing-wallet-will-unpair-vault"
        helpText={() => (
          <ul className="list-disc ml-4">
            <li className="my-2">
              All Avatar NFTs, subreddit tokens, etc you currently see on your
              Reddit account are owned by your current Vault’s address (the long{" "}
              <code>0x...</code> code).
            </li>
            <li className="my-2">
              Pairing your Wallet will not change the ownership of your Avatars
              and tokens.
              <ul className="list-disc ml-4">
                <li className="my-2">
                  After pairing your Wallet as your Vault, your Reddit account
                  will only have Avatars and tokens owned by your Wallet’s
                  address.
                </li>
                <li className="my-2">
                  To continue using your current Avatars and tokens after
                  changing your Vault, you will need to transfer them from your
                  Vault's address to your Wallet’s address. You can do this
                  before or after changing your Vault.
                </li>
              </ul>
            </li>
          </ul>
        )}
      >
        <p className="mt-0 my-4">
          Pairing your Wallet as your Reddit account’s Vault will un-pair your
          current Vault’s address from your Reddit account.
        </p>
      </PairingStepsInlineHelp>
    );
  } else {
    return (
      <p className="mb-4">
        Your Reddit account doesn’t currently have a Vault. To begin pairing
        your Wallet as your Reddit Vault, press <em>Start Pairing</em>.
      </p>
    );
  }
}

function StartPairingForm({
  pairingId,
  hasActiveVault,
  createAddressOwnershipChallenge,
}: {
  createAddressOwnershipChallenge: UseCreateAddressOwnershipChallengeResult;
  pairingId: PairingId;
  hasActiveVault: boolean;
}): JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);

  const {
    startPairingAttemptsBlocked,
    startPairingChecklist,
    updatePairingState,
  } = usePairingState(pairingId, ({ pairing }) => ({
    fetchedPairingMessage: pairing.fetchedPairingMessage,
    startPairingAttemptsBlocked: pairing.startPairingAttemptsBlocked,
    startPairingChecklist: pairing.startPairingChecklist,
  }));

  const toggleChecklist = (item: PairingChecklist) =>
    updatePairingState({
      startPairingChecklist: { [item]: !startPairingChecklist[item] },
    });

  const isFormValid = (): boolean => {
    if (!hasActiveVault) return true;
    return (
      startPairingChecklist.madeBackup &&
      startPairingChecklist.loadedBackup &&
      startPairingChecklist.testedBackup
    );
  };

  const focusFirstInvalidInput = () => {
    formRef.current
      ?.querySelector<HTMLInputElement>(
        "input[type='checkbox'][required]:not(:checked)",
      )
      ?.focus();
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (createAddressOwnershipChallenge.status !== "idle") {
      log.error("ignored onSubmit() while not idle");
      return;
    }
    if (isFormValid()) {
      log.debug("form submit OK", e);

      createAddressOwnershipChallenge.mutate();
    } else {
      log.debug("form submit blocked", startPairingAttemptsBlocked + 1);

      updatePairingState({
        startPairingAttemptsBlocked: startPairingAttemptsBlocked + 1,
      });
      focusFirstInvalidInput();
    }
  };

  return (
    <form ref={formRef} noValidate={true} onSubmit={submit}>
      {hasActiveVault ?
        <PrePairingChecklist
          startPairingChecklist={startPairingChecklist}
          toggleChecklist={toggleChecklist}
        />
      : undefined}
      <PairingStepsInlineHelp
        iconOffsetTop="50%"
        helpId="start-pairing-button"
        helpText={() => (
          <>
            To un-pair your current Vault and pair your Wallet as your new
            Reddit Vault, press <em>Start Pairing</em>.
          </>
        )}
      >
        <Button
          disabled={createAddressOwnershipChallenge.status !== "idle"}
          size="l"
          className="relative block m-4"
        >
          Start Pairing
          {createAddressOwnershipChallenge.status === "pending" ?
            <div className="absolute bottom-0 left-0 w-full">
              <IndeterminateProgressBar />
            </div>
          : undefined}
        </Button>
      </PairingStepsInlineHelp>
    </form>
  );
}

function PrePairingChecklist({
  startPairingChecklist,
  toggleChecklist,
}: {
  startPairingChecklist: Record<PairingChecklist, boolean>;
  toggleChecklist: (item: PairingChecklist) => void;
}): JSX.Element {
  return (
    <>
      <Heading
        id="pre-pairing-checklist"
        level={4}
        visualLevel={5}
        className="mb-0"
      >
        Pre-Pairing Checklist
      </Heading>
      <fieldset aria-labelledby="pre-pairing-checklist">
        <ul className="my-4">
          <li className="my-2">
            <PairingStepsInlineHelp
              helpId="backup-vault-before-pairing"
              helpText={() => (
                <>
                  <p>
                    <strong>
                      You must have a backup of your Vault before continuing to
                      pair your Wallet.
                    </strong>
                  </p>
                  <p>
                    Follow{" "}
                    <Link href="https://support.reddithelp.com/hc/en-us/search?utf8=%E2%9C%93&query=vault+backup">
                      Reddit’s instructions to backup your vault
                    </Link>
                    . Specifically, you must have a record of your 12-word seed
                    phrase in a safe place — you need it to access your current
                    Vault’s address after it’s un-paired from Reddit.
                  </p>
                </>
              )}
            >
              <InlineCheckBox
                required={true}
                selected={startPairingChecklist.madeBackup}
                onChange={() => toggleChecklist(PairingChecklist.madeBackup)}
                name="made-backup"
                label="I have a backup of my current Vault's 12-word phrase."
              />
            </PairingStepsInlineHelp>
          </li>
          <li className="my-2">
            <PairingStepsInlineHelp
              helpId="loaded-vault-backup-into-wallet"
              helpText={() => (
                <>
                  By loading your 12-word phrase into a conventional Wallet, you
                  are checking that your backup worked.
                </>
              )}
            >
              <InlineCheckBox
                required={true}
                selected={startPairingChecklist.loadedBackup}
                onChange={() => toggleChecklist(PairingChecklist.loadedBackup)}
                name="loaded-backup"
                label="I have loaded my Vault's 12-word phrase into a Wallet."
              />
            </PairingStepsInlineHelp>
          </li>
          <li className="my-2">
            <PairingStepsInlineHelp
              helpId="made-transfer-from-vault-to-wallet"
              helpText={() => (
                <>
                  By transferring an Avatar, you are confirming that you are
                  able to control your Vault's address from outside the Reddit
                  app. You're also checking that you understand the process of
                  transferring NFTs to your new Wallet.
                </>
              )}
            >
              <InlineCheckBox
                required={true}
                selected={startPairingChecklist.testedBackup}
                onChange={() => toggleChecklist(PairingChecklist.testedBackup)}
                name="tested-backup"
                label="I have used my Vault-Wallet to transfer an Avatar from my Vault's address to my new Wallet's address."
              />
            </PairingStepsInlineHelp>
          </li>
        </ul>
      </fieldset>
    </>
  );
}

const BLOCKED_START_SEQUENCE = [
  "You must backup your Vault before un-pairing it.",
  "Please backup your Vault.",
  "Think how your future self would feel if they lost access to their old Vault.",
  "I don't think they'd be very pleased with their past self.",
  "You really should do these things before continuing.",
  "I'm afraid I can't let you carry on until you tell me your Vault is safe.",
  "If you really must, you could lie to me, I won't know.",
  "It would make me sad though. 😓",
  "Computer programs have feelings too you know.",
  "And think how lonely all the things in your Vault would be if you couldn't access them.",
  "It would be better for everyone if you backed-up your Vault and tested it.",
  "I'm going to run out of things to tell you soon — I'm not an LLM.",
];

function blockedStartPairingDetails(count: number): string | undefined {
  if (count < 1) return undefined;
  if (count - 2 < BLOCKED_START_SEQUENCE.length * 2) {
    return BLOCKED_START_SEQUENCE[(count - 2) % BLOCKED_START_SEQUENCE.length];
  }
  return [
    sample(["Please!", "Please!!", "Please…", "Pretty please?", ""]),
    sample([
      "😢",
      "😟",
      "😔",
      "😞",
      "😕",
      "🙁",
      "😣",
      "😫",
      "😩",
      "😳",
      "🥺",
      "😶",
      "😐",
      "🫣",
      "🫤",
      "😧",
      "😮‍💨",
    ]),
  ].join(" ");
}

function sample<T>(things: T[]): T {
  assert(things.length > 0);
  return things[Math.floor(Math.random() * things.length)];
}
