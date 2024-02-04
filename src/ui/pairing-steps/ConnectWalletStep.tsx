import { ReactElement } from "react";
import { useAccount } from "wagmi";

import { assert, assertUnreachable } from "../../assert";
import { ErrorCode } from "../../reddit/reddit-interaction-spec";
import { useRedditAccount } from "../hooks/useRedditAccount";
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

  const content: ReactElement[] = [];
  if (
    !redditAccount.isRedditAvailable ||
    redditAccount.data?.error?.type === ErrorCode.REDDIT_TAB_DISCONNECTED
  ) {
    content.push(
      <StepAction
        key="reddit-account"
        state="error"
        headline="Vaultonomy is not connected to a Reddit tab"
        details={
          <a
            className="underline underline-offset-2 text-blue-500"
            href="#account"
          >
            Connect to a Reddit tab to continue.
          </a>
        }
      />,
    );
    return { state: "present", content };
  }
  if (redditAccount.status === "pending") {
    content.push(
      <StepAction
        key="reddit-account"
        state="pending"
        headline="Getting Reddit account details…"
      />,
    );
    return { state: "present", content };
  }
  if (redditAccount.data?.error) {
    assert(redditAccount.data?.error.type === ErrorCode.USER_NOT_LOGGED_IN);

    content.push(
      <StepAction
        key="reddit-account"
        state="error"
        headline="You're not logged in on Reddit"
        details="Log in on your Reddit tab and try again."
      />,
    );
    return { state: "present", content };
  }
  if (redditAccount.error) {
    content.push(
      <RedditErrorStepAction
        key="reddit-account"
        while="getting your account details from Reddit"
      />,
    );
    return { state: "present", content };
  }

  assert(redditAccount.data);
  content.push(
    <StepAction
      key="reddit-account"
      state="done"
      headline="Reddit account connected"
    />,
  );

  const state = account.isConnected ? "past" : "present";

  switch (account.status) {
    case "connected":
    // Treat reconnecting as connected as wagmi seems to toggle to reconnecting
    // when re-rendering for no apparent reason, which causes the loading
    // indicator to flash for a split second.
    case "reconnecting":
      content.push(
        <StepAction key="connected" state="done" headline="Wallet connected" />,
      );
      break;
    case "connecting":
    case "disconnected":
      content.push(
        <StepBody key="body">
          <p className="mb-4">
            <a
              // TODO: create a custom anchor element
              className="underline underline-offset-2 text-blue-500"
              href="#wallet"
            >
              Connect your Wallet
            </a>{" "}
            to continue.
          </p>
        </StepBody>,
      );
      if (account.status === "connecting") {
        content.push(
          <StepAction
            key="connecting"
            state="pending"
            headline="Wallet connecting…"
          />,
        );
      }
      break;
    default:
      assertUnreachable(account);
  }
  return { state, content };
}

export function ConnectWalletStep(): JSX.Element {
  const { state, content } = renderState();

  return (
    <PairingStep num={1} name="Connect Reddit & Wallet" state={state}>
      {content}
    </PairingStep>
  );
}
