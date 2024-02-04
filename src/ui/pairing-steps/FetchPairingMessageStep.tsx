import { ReactElement, ReactNode } from "react";
import { useAccount } from "wagmi";

import { assertUnreachable } from "../../assert";
import { Button } from "../Button";
import { Link } from "../Link";
import { CheckBox, InlineCheckBox } from "../forms/CheckBox";
import { usePairingMessage } from "../hooks/usePairingMessage";
import { useRedditAccount } from "../hooks/useRedditAccount";
import { useRedditAccountActiveVault } from "../hooks/useRedditAccountActiveVault";
import { useVaultonomyStore } from "../state/useVaultonomyStore";
import {
  PairingStep,
  PairingStepState,
  StepAction,
  StepBody,
} from "./components";
import { RedditErrorStepAction } from "./steps";

function renderState(): { state: PairingStepState; content?: ReactElement[] } {
  const account = useAccount();
  const redditAccount = useRedditAccount();
  const activeVault = useRedditAccountActiveVault();
  const fetchedPairingMessage = usePairingMessage();

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
        <p className="mt-0 my-4">
          Pairing your Wallet as your Reddit account’s Vault will un-pair your
          current Vault’s address from your Reddit account.
        </p>
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
                To continue using your current Avatars and tokens after changing
                your Vault, you will need to transfer them from your Vault's
                address to your Wallet’s address. You can do this before or
                after changing your Vault.
              </li>
            </ul>
          </li>
        </ul>

        <p className="my-4">
          <strong>
            You must have a backup of your Vault before continuing to pair your
            Wallet.
          </strong>{" "}
        </p>
        <p className="my-4">
          Follow{" "}
          <Link href="https://support.reddithelp.com/hc/en-us/search?utf8=%E2%9C%93&query=vault+backup">
            Reddit’s instructions to backup your vault
          </Link>
          . Specifically, you must have a record of your 12-word seed phrase in
          a safe place — you need it to access your current Vault’s address
          after it’s un-paired from Reddit.
        </p>

        <form>
          <fieldset>
            <legend>Pre-pairing checklist</legend>
            <ul className="my-4">
              <li>
                <InlineCheckBox
                  name="made-backup"
                  label="I have a backup of my current Vault's 12-word phrase."
                />
              </li>
              <li>
                <InlineCheckBox
                  name="loaded-backup"
                  label="I have loaded my Vault's 12-word phrase into a non-Reddit Wallet."
                  description={
                    <small>
                      By loading your 12-word phrase into a conventional Wallet,
                      you are checking that your backup worked.
                    </small>
                  }
                />
              </li>
              <li>
                <InlineCheckBox
                  name="tested-backup"
                  label="I have used my non-Reddit Wallet to transfer an Avatar from my Vault's address to my new Wallet's address."
                  description={
                    <small className="leading-tight">
                      By transferring an Avatar, you are confirming that you are
                      able to control your Vault's address from outside the
                      Reddit app. You're also checking that you understand the
                      process of transferring NFTs to your new Wallet.
                    </small>
                  }
                />
              </li>
            </ul>
          </fieldset>
        </form>

        <p className="my-4">
          To un-pair your current Vault and pair your Wallet as your new Reddit
          Vault, hit Start Pairing.
        </p>
        {/* TODO: tickbox checklist ? */}
        {/* <p className="mb-4">To pair your Wallet with your Reddit account XXX</p> */}
        {/* TODO: confirmations of transactions? */}
        <Button size="l" className="block m-4">
          Start Pairing
        </Button>
      </StepBody>,
    );
  }

  if (fetchedPairingMessage?.error) {
    content.push(
      <RedditErrorStepAction while="asking Reddit to start pairing your Wallet" />,
    );
    return { state: "present", content };
  }

  return { state: "present", content };
}

export function FetchPairingMessageStep(): JSX.Element {
  const { state, content } = renderState();

  return (
    <PairingStep num={2} name="Get Ready" state={state}>
      {content}
      {/* Wallet pairing message fetched from Reddit */}
      {/* <StepAction state="error">
        Failed to fetch pairing message from Reddit
      </StepAction> */}
    </PairingStep>
  );
}
