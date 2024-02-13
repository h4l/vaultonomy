import { ReactNode } from "react";
import { UseAccountReturnType } from "wagmi";

import { assert, assertUnreachable } from "../../assert";
import { AccountVaultAddress } from "../../reddit/api-client";
import { RedditProviderError } from "../../reddit/reddit-interaction-client";
import { ErrorCode } from "../../reddit/reddit-interaction-spec";
import { Link } from "../Link";
import { UseRedditAccountResult } from "../hooks/useRedditAccount";
import { UseRedditAccountActiveVaultResult } from "../hooks/useRedditAccountActiveVault";
import { WALLET } from "../ids";
import {
  PairingStep,
  PairingStepState,
  StepAction,
  StepBody,
} from "./components";
import { RedditErrorStepAction } from "./steps";

export function ConnectWalletStep({
  redditAccount,
  activeVault,
  wallet,
}: {
  redditAccount: UseRedditAccountResult;
  activeVault: UseRedditAccountActiveVaultResult;
  wallet: UseAccountReturnType;
}): JSX.Element {
  if (
    !redditAccount.isRedditAvailable ||
    (redditAccount.error instanceof RedditProviderError &&
      redditAccount.error.type === ErrorCode.REDDIT_TAB_DISCONNECTED)
  ) {
    return (
      <ThisStep state="present">
        <StepAction
          state="error"
          headline="Vaultonomy is not connected to a Reddit tab"
          details={
            <>
              <Link toId="account">Connect to a Reddit tab</Link> to continue.
            </>
          }
        />
        ,
      </ThisStep>
    );
  }

  if (redditAccount.status === "pending" || activeVault.status === "pending") {
    return (
      <ThisStep state="present">
        <StepAction
          key="reddit-account"
          state="pending"
          headline="Getting Reddit account details…"
        />
        ,
      </ThisStep>
    );
  }
  if (redditAccount.error instanceof RedditProviderError) {
    assert(redditAccount.error.type === ErrorCode.USER_NOT_LOGGED_IN);
    return (
      <ThisStep state="present">
        <StepAction
          key="reddit-account"
          state="error"
          headline="You're not logged in on Reddit"
          details="Log in on your Reddit tab and try again."
        />
      </ThisStep>
    );
  }
  if (redditAccount.error || activeVault.error) {
    <ThisStep state="present">
      <RedditErrorStepAction
        key="reddit-account"
        while="getting your account details from Reddit"
      />
    </ThisStep>;
  }

  assert(redditAccount.data);

  // Treat reconnecting as connected as wagmi seems to toggle to reconnecting
  // when re-rendering for no apparent reason, which causes the loading
  // indicator to flash for a split second.
  if (wallet.status === "connected" || wallet.status === "reconnecting") {
    return (
      <ThisStep state="past">
        <StepAction
          key="reddit-account"
          state="done"
          headline="Reddit account connected"
        />
        <StepAction key="connected" state="done" headline="Wallet connected" />
      </ThisStep>
    );
  } else if (
    wallet.status === "connecting" ||
    wallet.status === "disconnected"
  ) {
    return (
      <ThisStep state="present">
        <StepBody key="body">
          <p className="mb-4">
            <Link toId={WALLET}>Connect your Wallet</Link> to continue.
          </p>
        </StepBody>
        {wallet.status === "connecting" ?
          <StepAction
            key="connecting"
            state="pending"
            headline="Wallet connecting…"
          />
        : undefined}
      </ThisStep>
    );
  }

  assertUnreachable(wallet);
}

function ThisStep({
  state,
  children,
}: {
  state: PairingStepState;
  children?: ReactNode;
}) {
  return (
    <PairingStep num={1} name="Connect Reddit & Wallet" state={state}>
      {children}
    </PairingStep>
  );
}
