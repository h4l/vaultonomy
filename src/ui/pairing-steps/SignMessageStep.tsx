import { ReactNode, useState } from "react";
import { Address } from "viem";
import { mainnet } from "viem/chains";
import { useSwitchChain } from "wagmi";

import { assertUnreachable } from "../../assert";
import { NormalisedRedditEIP712Challenge } from "../../signing";
import { RequiredNonNullable } from "../../types";
import { Button } from "../Button";
import { IndeterminateProgressBar } from "../IndeterminateProgressBar";
import { Link } from "../Link";
import { useSignAddressOwnershipChallenge } from "../hooks/useSignAddressOwnershipChallenge";
import { PAIRING_MESSAGE, WALLET } from "../ids";
import { PairingId } from "../state/createVaultonomyStore";
import { usePairingState } from "../state/usePairingState";
import { PairingStepsInlineHelp } from "./PairingStepsInlineHelp";
import {
  PairingStep,
  PairingStepState,
  StepAction,
  StepBody,
} from "./components";

function ThisStep({
  state,
  children,
}: {
  state: PairingStepState;
  children?: ReactNode;
}) {
  return (
    // <PairingStep num={3} name="Approve Pairing Message" state={state}>
    <PairingStep num={3} name="Get Set" state={state}>
      {children}
    </PairingStep>
  );
}

export type SignMessageStepParams = {
  pairingId: PairingId | undefined;
  address: Address | undefined;
  walletChainId: number | undefined;
  challenge: NormalisedRedditEIP712Challenge | undefined;
};

export function SignMessageStep({
  pairingId,
  address,
  walletChainId,
  challenge,
}: SignMessageStepParams): JSX.Element {
  if (
    pairingId === undefined ||
    address === undefined ||
    walletChainId === undefined ||
    challenge === undefined
  ) {
    return <ThisStep state="future" />;
  }

  return (
    <SignMessage
      pairingId={pairingId}
      address={address}
      walletChainId={walletChainId}
      challenge={challenge}
    />
  );
}

// type SignMessageParams = Required<SignMessageStepParams>

type SignMessageParams = RequiredNonNullable<SignMessageStepParams>;
function SignMessage({
  pairingId,
  address,
  walletChainId,
  challenge,
}: SignMessageParams): JSX.Element {
  const [userDidSwitchChains, setUserDidSwitchChains] =
    useState<boolean>(false);
  const { mutate, status, error } = useSignAddressOwnershipChallenge({
    pairingId,
    address,
    challenge,
  });
  const { signedPairingMessage } = usePairingState(
    pairingId,
    ({ pairing }) => ({ signedPairingMessage: pairing.signedPairingMessage }),
  );

  if (status === "success" || signedPairingMessage?.result === "ok") {
    return (
      <ThisStep state="past">
        <StepAction state="done" headline="Signed Pairing Message" />
      </ThisStep>
    );
  }

  if (
    walletChainId !== undefined &&
    BigInt(walletChainId) !== challenge.domain.chainId
  ) {
    return (
      <ThisStep state="present">
        <EnableEthereumInWallet
          onSwitchStart={() => setUserDidSwitchChains(true)}
        />
      </ThisStep>
    );
  }

  return (
    <ThisStep state="present">
      {userDidSwitchChains ?
        <StepAction state="done" headline="Wallet using Ethereum network" />
      : undefined}
      <StepBody>
        <p className="mb-2">
          Sign{" "}
          <Link toId={PAIRING_MESSAGE}>Reddit's Vault Pairing Message</Link>{" "}
          with your Wallet to prove to Reddit that:
        </p>
        <ul className="list-disc ml-6 my-2">
          <li>
            <PairingStepsInlineHelp
              iconOffsetLeft="-2.15rem"
              helpText={
                "This stops a bad person pairing someone else's Wallet to their account."
              }
            >
              You own your Wallet's address.
            </PairingStepsInlineHelp>
          </li>
          <li>
            <PairingStepsInlineHelp
              iconOffsetLeft="-2.15rem"
              helpText={
                "The message expires after a few minutes, so your signature proves you are present right now."
              }
            >
              You wish to make it your Vault address.
            </PairingStepsInlineHelp>
          </li>
        </ul>
        <PairingStepsInlineHelp
          iconOffsetTop="50%"
          helpId="sign-message-button"
          helpText={() => (
            <>Signing is free, it does not create an on-chain transaction.</>
          )}
        >
          <Button
            size="l"
            className="relative block m-4"
            disabled={status === "pending"}
            onClick={() => mutate()}
          >
            Sign Message
            {status === "pending" ?
              <div className="absolute bottom-0 left-0 w-full">
                <IndeterminateProgressBar />
              </div>
            : undefined}
          </Button>
        </PairingStepsInlineHelp>
      </StepBody>
      {status === "pending" && (
        <StepAction
          state="pending"
          headline="Awaiting signature from your Wallet…"
        />
      )}
      {signedPairingMessage?.error && status !== "pending" ?
        signedPairingMessage.error === "user-cancelled" ?
          undefined
        : signedPairingMessage.error === "wallet-cancelled" ?
          <StepAction
            state="error"
            headline="Your Wallet rejected your signature request"
            details={
              <>
                <p className="my-2">
                  Unless you cancelled the request yourself, your Wallet may be
                  blocking the typed-data ("EIP-712") signature format of
                  Reddit's Message for security reasons.
                </p>

                <p className="my-2">
                  For example, Ledger Live auto-rejects typed-data signature
                  requests that it doesn't have prior knowledge of. And it does
                  not yet know about Reddit's. But connecting a Ledger device
                  via MetaMask works correctly.
                </p>
              </>
            }
          />
        : <SignMessageError error={signedPairingMessage.error} />
      : undefined}
    </ThisStep>
  );
}

function EnableEthereumInWallet({
  onSwitchStart,
}: {
  onSwitchStart?: () => void;
}) {
  const { switchChain, status, error } = useSwitchChain();
  return (
    <>
      <StepAction
        state="error"
        headline={`Your Wallet app has the wrong network enabled`}
        details={
          <>
            Your Wallet app needs to enable the Ethereum network to sign
            Reddit's Message.
            <Button
              size="l"
              className="relative block m-4"
              onClick={() => {
                onSwitchStart && onSwitchStart();
                switchChain({ chainId: mainnet.id });
              }}
            >
              Enable Ethereum Chain
              {status === "pending" ?
                <div className="absolute bottom-0 left-0 w-full">
                  <IndeterminateProgressBar />
                </div>
              : undefined}
            </Button>
          </>
        }
      />
      {status === "error" && error?.name !== "UserRejectedRequestError" ?
        <StepAction
          state="error"
          headline="Vaultonomy hit an error while asking your Wallet to enable the Ethereum network."
        />
      : undefined}
      {status === "pending" ?
        <StepAction
          state="pending"
          headline="Asking Wallet app to enable the Ethereum network…"
        />
      : undefined}
    </>
  );
}

function SignMessageError({
  error,
}: {
  error: "sign-failed" | "signature-invalid";
}): JSX.Element {
  if (error === "sign-failed") {
    return (
      <StepAction
        state="error"
        headline="Vaultonomy hit an error while requesting your Wallet to sign the Message"
      />
    );
  } else if (error === "signature-invalid") {
    return (
      <StepAction
        state="error"
        headline="The Message signature your Wallet provided is not correct"
        details={
          <>
            The signature doesn't match Reddit's Message and your Wallet
            address.
            <ul className="list-outside list-disc ml-6">
              <li>
                Is your Wallet showing the same <code>0x...</code> address as
                the <Link toId={WALLET}>Wallet</Link> section above? If not,
                reconnect your Wallet and try again.
              </li>
              <li>
                Did your Wallet show you the fields of{" "}
                <Link toId={PAIRING_MESSAGE}>Reddit's Message</Link>? If not,
                your Wallet may not support signing this type of structured
                data.
              </li>
            </ul>
          </>
        }
      />
    );
  }
  assertUnreachable(error);
}
