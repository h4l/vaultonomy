import { ReactNode } from "react";
import { UseAccountReturnType } from "wagmi";

import { assert, assertUnreachable } from "../../assert";
import { RedditProviderError } from "../../reddit/reddit-interaction-client";
import { ErrorCode } from "../../reddit/reddit-interaction-spec";
import { Link } from "../Link";
import { UseRedditAccountResult } from "../hooks/useRedditAccount";
import { UseRedditAccountActiveVaultResult } from "../hooks/useRedditAccountVaults";
import { WALLET, YOUR_ACCOUNT } from "../ids";
import { PairingStep, PairingStepState, StepAction } from "./components";
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
  const redditConnected =
    redditAccount.isRedditAvailable &&
    redditAccount.isFetched &&
    activeVault.isFetched;
  const walletConnected = wallet.isConnected;
  const state: PairingStepState =
    redditConnected && walletConnected ? "past" : "present";

  return (
    <ThisStep state={state}>
      <ConnectToReddit
        redditAccount={redditAccount}
        activeVault={activeVault}
      />
      {redditConnected ?
        <ConnectToWallet wallet={wallet} />
      : undefined}
    </ThisStep>
  );
}

type ConnectToRedditProps = {
  redditAccount: UseRedditAccountResult;
  activeVault: UseRedditAccountActiveVaultResult;
};

function ConnectToReddit({
  redditAccount,
  activeVault,
}: ConnectToRedditProps): JSX.Element {
  if (
    !redditAccount.isRedditAvailable ||
    (redditAccount.error instanceof RedditProviderError &&
      (redditAccount.error.type === ErrorCode.REDDIT_TAB_NOT_CONNECTED ||
        redditAccount.error.type === ErrorCode.REDDIT_TAB_DISCONNECTED))
  ) {
    return (
      <StepAction
        state="error"
        headline="Vaultonomy is not connected to a Reddit tab"
        details={
          <>
            <Link toId={YOUR_ACCOUNT}>Connect to a Reddit tab</Link> to
            continue.
          </>
        }
      />
    );
  }

  if (redditAccount.status === "pending" || activeVault.status === "pending") {
    return (
      <StepAction
        key="reddit-account"
        state="pending"
        headline="Getting Reddit account details…"
      />
    );
  }
  if (redditAccount.error instanceof RedditProviderError) {
    assert(redditAccount.error.type === ErrorCode.USER_NOT_LOGGED_IN);
    return (
      <StepAction
        key="reddit-account"
        state="error"
        headline="You're not logged in on Reddit"
        details="Log in on your Reddit tab and try again."
      />
    );
  }
  if (redditAccount.error || activeVault.error) {
    <RedditErrorStepAction
      key="reddit-account"
      while="getting your account details from Reddit"
    />;
  }

  return (
    <StepAction
      key="reddit-account"
      state="done"
      headline="Reddit account connected"
    />
  );
}

type ConnectToWalletProps = { wallet: UseAccountReturnType };

function ConnectToWallet({ wallet }: ConnectToWalletProps): JSX.Element {
  // Treat reconnecting as connected as wagmi seems to toggle to reconnecting
  // when re-rendering for no apparent reason, which causes the loading
  // indicator to flash for a split second.
  if (wallet.status === "connected" || wallet.status === "reconnecting") {
    return (
      <StepAction key="connected" state="done" headline="Wallet connected" />
    );
  } else if (
    wallet.status === "connecting" ||
    wallet.status === "disconnected"
  ) {
    return (
      <>
        <StepAction
          state="error"
          headline="Your Wallet is not connected"
          details={
            <>
              <Link toId={WALLET}>Connect your Wallet</Link> to continue.
            </>
          }
        />
        {wallet.status === "connecting" ?
          <StepAction
            key="connecting"
            state="pending"
            headline="Wallet connecting…"
          />
        : undefined}
      </>
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
