import { ReactNode, useRef } from "react";
import { Address } from "viem";
import { useAccount } from "wagmi";

import { assert } from "../../assert";
import { log } from "../../logging";
import { Button } from "../Button";
import { Heading } from "../Heading";
import { Link } from "../Link";
import { InlineCheckBox } from "../forms/CheckBox";
import { useCreateAddressOwnershipChallenge } from "../hooks/useCreateAddressOwnershipChallenge";
import { usePairingMessage } from "../hooks/usePairingMessage";
import { useRedditAccount } from "../hooks/useRedditAccount";
import {
  RedditAccountActiveVaultResult,
  useRedditAccountActiveVault,
} from "../hooks/useRedditAccountActiveVault";
import {
  FetchedPairingMessage,
  PairingChecklist,
} from "../state/createVaultonomyStore";
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
    <PairingStep num={2} name="Prepare to Pair" state={state}>
      {children}
    </PairingStep>
  );
}

export function FetchPairingMessageStep({
  address,
  userId,
  redditUserName,
  activeVault,
  fetchedPairingMessage,
}: {
  address: Address | undefined;
  userId: string | undefined;
  redditUserName: string | undefined;
  activeVault: RedditAccountActiveVaultResult;
  fetchedPairingMessage: FetchedPairingMessage | null;
}): JSX.Element {
  if (!address || !userId || !redditUserName) {
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
      <ThisStep state="past">
        <StepAction
          state="done"
          headline="Received pairing message from Reddit"
        />
      </ThisStep>
    );
  }

  return (
    <FetchPairingMessage
      address={address}
      fetchedPairingMessage={fetchedPairingMessage}
      hasActiveVault={!!activeVault.data}
      userId={userId}
      redditUserName={redditUserName}
    />
  );
}

function FetchPairingMessage({
  userId,
  redditUserName,
  address,
  hasActiveVault,
  fetchedPairingMessage,
}: {
  userId: string;
  redditUserName: string;
  address: Address;
  hasActiveVault: boolean;
  fetchedPairingMessage: FetchedPairingMessage | null;
}): JSX.Element {
  const startPairingAttemptsBlocked = useVaultonomyStoreUser(
    userId,
    ({ user }) => user.startPairingAttemptsBlocked,
  );

  const mutation = useCreateAddressOwnershipChallenge({
    userId,
    redditUserName,
    address,
  });

  return (
    <ThisStep state="present">
      {/* TODO: should we include this confirmation? Seems unnecessary. */}
      <StepAction
        state="done"
        headline="Got your Vault details"
        // details={
        //   hasActiveVault ?
        //     "Your account has an active Vault"
        //   : "Your account has no active Vault"
        // }
      />
      <StepBody>
        <PairingStartPreamble hasActiveVault={hasActiveVault} />
        <StartPairingForm
          onSubmit={mutation.mutate}
          hasActiveVault={hasActiveVault}
          status={mutation.status}
          userId={userId}
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
        Your Reddit account doesn’t currently have a Vault. To pair your Wallet
        as your Reddit Vault, hit Start Pairing.
      </p>
    );
  }
}

function StartPairingForm({
  userId,
  hasActiveVault,
  onSubmit,
  status,
}: {
  userId: string | undefined;
  hasActiveVault: boolean;
  onSubmit: () => void;
  status: "pending" | "idle" | "success" | "error";
}): JSX.Element {
  const formRef = useRef<HTMLFormElement>(null);

  const {
    startPairingAttemptsBlocked,
    setStartPairingAttemptsBlocked,
    checklist,
    updateChecklist,
  } = useVaultonomyStoreUser(userId, ({ user, s }) => ({
    startPairingAttemptsBlocked: user.startPairingAttemptsBlocked,
    setStartPairingAttemptsBlocked: (startPairingAttemptsBlocked: number) => {
      userId ?
        s.updateUser(userId)({ startPairingAttemptsBlocked })
      : undefined;
    },
    checklist: user.startPairingChecklist,
    updateChecklist: (item: PairingChecklist, done: boolean) => {
      userId ?
        s.updateUser(userId)({ startPairingChecklist: { [item]: done } })
      : undefined;
    },
  }));

  const toggleChecklist = (item: PairingChecklist) =>
    updateChecklist(item, !checklist[item]);

  const isFormValid = (): boolean => {
    if (!hasActiveVault) return true;
    return (
      checklist.madeBackup && checklist.loadedBackup && checklist.testedBackup
    );
  };

  const focusFirstInvalidInput = () => {
    formRef.current
      ?.querySelector<HTMLInputElement>(
        "input[type='checkbox'][required]:not(:checked)",
      )
      ?.focus();
  };

  return (
    <form
      ref={formRef}
      noValidate={true}
      onSubmit={(e) => {
        e.preventDefault();
        if (status !== "idle") {
          log.error("ignored onSubmit() while not idle");
          return;
        }
        if (isFormValid()) {
          log.debug("form submit OK", e);

          onSubmit();
        } else {
          log.debug("form submit blocked", startPairingAttemptsBlocked + 1);

          setStartPairingAttemptsBlocked(startPairingAttemptsBlocked + 1);
          focusFirstInvalidInput();
        }
      }}
    >
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
                selected={checklist.madeBackup}
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
                selected={checklist.loadedBackup}
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
                selected={checklist.testedBackup}
                onChange={() => toggleChecklist(PairingChecklist.testedBackup)}
                name="tested-backup"
                label="I have used my Vault-Wallet to transfer an Avatar from my Vault's address to my new Wallet's address."
              />
            </PairingStepsInlineHelp>
          </li>
        </ul>
      </fieldset>
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
        <Button disabled={status !== "idle"} size="l" className="block m-4">
          Start Pairing
        </Button>
      </PairingStepsInlineHelp>
    </form>
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
