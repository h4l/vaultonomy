import { ReactElement, ReactNode, useRef, useState } from "react";
import { useAccount } from "wagmi";

import { assert, assertUnreachable } from "../../assert";
import { log } from "../../logging";
import { Button } from "../Button";
import { Heading } from "../Heading";
import { WithInlineHelp } from "../Help";
import { Link } from "../Link";
import { CheckBox, InlineCheckBox } from "../forms/CheckBox";
import { usePairingMessage } from "../hooks/usePairingMessage";
import { useRedditAccount } from "../hooks/useRedditAccount";
import { useRedditAccountActiveVault } from "../hooks/useRedditAccountActiveVault";
import { useVaultonomyStore } from "../state/useVaultonomyStore";
import { PairingStepsInlineHelp } from "./PairingStepsInlineHelp";
import {
  PairingStep,
  PairingStepState,
  StepAction,
  StepBody,
} from "./components";
import { RedditErrorStepAction } from "./steps";

type Checklist = {
  madeBackup?: boolean;
  loadedBackup?: boolean;
  testedBackup?: boolean;
};

function renderState(): { state: PairingStepState; content?: ReactElement[] } {
  const account = useAccount();
  const redditAccount = useRedditAccount();
  const activeVault = useRedditAccountActiveVault();
  const fetchedPairingMessage = usePairingMessage();
  const formRef = useRef<HTMLFormElement>(null);
  const [checklist, setChecklist] = useState<Checklist>({});
  const [blockedStartPairingCount, setBlockedStartPairingCount] = useState(0);

  const toggleChecklist = (name: keyof Checklist) =>
    setChecklist({ ...checklist, [name]: !checklist[name] });

  if (!account.isConnected || !redditAccount.data?.profile) {
    return { state: "future" };
  }

  if (fetchedPairingMessage?.value) {
    return {
      state: "past",
      content: [
        <StepAction
          key="received"
          state="done"
          headline="Received pairing message from Reddit"
        />,
      ],
    };
  }

  const content: ReactElement[] = [];
  if (activeVault.isError) {
    content.push(
      <RedditErrorStepAction
        key="active-vault"
        while="getting your Vault details from Reddit"
      />,
    );
    return { state: "present", content };
  }
  if (activeVault.isLoading) {
    content.push(
      <StepAction
        key="active-vault"
        state="pending"
        headline="Getting your Vault details"
      />,
    );
    return { state: "present", content };
  }
  // content.push(
  //   <StepAction
  //     key="active-vault"
  //     state="done"
  //     headline="Got your Vault details"
  //   />,
  // );

  if (!activeVault.data) {
    content.push(
      <StepBody key="body">
        <p className="mb-4">
          Your Reddit account doesn’t currently have a Vault. To pair your
          Wallet as your Reddit Vault, hit Start Pairing.
        </p>
        {/* <p className="mb-4">To pair your Wallet with your Reddit account XXX</p> */}
        {/* TODO: confirmations of transactions? */}
        <Button size="l" className="block m-4">
          Start Pairing
        </Button>
      </StepBody>,
    );
  } else {
    content.push(
      <StepBody key="body">
        <PairingStepsInlineHelp
          helpId="pairing-wallet-will-unpair-vault"
          helpText={() => (
            <ul className="list-disc ml-4">
              <li className="my-2">
                All Avatar NFTs, subreddit tokens, etc you currently see on your
                Reddit account are owned by your current Vault’s address (the
                long <code>0x...</code> code).
              </li>
              <li className="my-2">
                Pairing your Wallet will not change the ownership of your
                Avatars and tokens.
                <ul className="list-disc ml-4">
                  <li className="my-2">
                    After pairing your Wallet as your Vault, your Reddit account
                    will only have Avatars and tokens owned by your Wallet’s
                    address.
                  </li>
                  <li className="my-2">
                    To continue using your current Avatars and tokens after
                    changing your Vault, you will need to transfer them from
                    your Vault's address to your Wallet’s address. You can do
                    this before or after changing your Vault.
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

        <form
          ref={formRef}
          noValidate={true}
          onSubmit={(e) => {
            e.preventDefault();
            if (
              checklist.madeBackup &&
              checklist.loadedBackup &&
              checklist.testedBackup
            ) {
              log.debug("form submit OK", e);
            } else {
              setBlockedStartPairingCount(blockedStartPairingCount + 1);
              log.debug("form submit blocked", blockedStartPairingCount + 1);
              formRef.current
                ?.querySelector<HTMLInputElement>(
                  "input[type='checkbox'][required]:not(:checked)",
                )
                ?.focus();
            }
          }}
          onError={(e) => log.debug("form error", e)}
        >
          <Heading
            id="pre-pairing-checklist"
            level={4}
            visualLevel={5}
            className="mb-0"
          >
            Pre-pairing checklist
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
                          You must have a backup of your Vault before continuing
                          to pair your Wallet.
                        </strong>
                      </p>
                      <p>
                        Follow{" "}
                        <Link href="https://support.reddithelp.com/hc/en-us/search?utf8=%E2%9C%93&query=vault+backup">
                          Reddit’s instructions to backup your vault
                        </Link>
                        . Specifically, you must have a record of your 12-word
                        seed phrase in a safe place — you need it to access your
                        current Vault’s address after it’s un-paired from
                        Reddit.
                      </p>
                    </>
                  )}
                >
                  <InlineCheckBox
                    required={true}
                    selected={checklist.madeBackup}
                    onChange={() => toggleChecklist("madeBackup")}
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
                      By loading your 12-word phrase into a conventional Wallet,
                      you are checking that your backup worked.
                    </>
                  )}
                >
                  <InlineCheckBox
                    required={true}
                    selected={checklist.loadedBackup}
                    onChange={() => toggleChecklist("loadedBackup")}
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
                      able to control your Vault's address from outside the
                      Reddit app. You're also checking that you understand the
                      process of transferring NFTs to your new Wallet.
                    </>
                  )}
                >
                  <InlineCheckBox
                    required={true}
                    selected={checklist.testedBackup}
                    onChange={() => toggleChecklist("testedBackup")}
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
            <Button size="l" className="block m-4">
              Start Pairing
            </Button>
          </PairingStepsInlineHelp>
        </form>

        {/* TODO: tickbox checklist ? */}
        {/* <p className="mb-4">To pair your Wallet with your Reddit account XXX</p> */}
        {/* TODO: confirmations of transactions? */}
      </StepBody>,
    );
    if (blockedStartPairingCount > 0) {
      log.debug("blockedStartPairingCount", blockedStartPairingCount);
      content.push(
        <StepAction
          key="pairing-start"
          state="error"
          alertKey={`${blockedStartPairingCount}`}
          headline={`Complete the Pre-pairing checklist`}
          details={blockedStartPairingDetails(blockedStartPairingCount)}
        />,
      );
    }
  }

  if (fetchedPairingMessage?.error) {
    content.push(
      <RedditErrorStepAction
        key="received"
        while="asking Reddit to start pairing your Wallet"
      />,
    );
    return { state: "present", content };
  }

  return { state: "present", content };
}

export function FetchPairingMessageStep(): JSX.Element {
  const { state, content } = renderState();

  return (
    <PairingStep num={2} name="Prepare to Pair" state={state}>
      {content}
      {/* Wallet pairing message fetched from Reddit */}
      {/* <StepAction state="error">
        Failed to fetch pairing message from Reddit
      </StepAction> */}
    </PairingStep>
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
