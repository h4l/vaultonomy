import { ReactElement, ReactNode, useId, useMemo, useRef } from "react";
import { Address } from "viem";
import { UseAccountReturnType } from "wagmi";

import { RedditEIP712Challenge } from "../reddit/reddit-interaction-client";
import {
  NormalisedRedditEIP712Challenge,
  normaliseRedditChallenge,
} from "../signing";
import { Button } from "./Button";
import { EthInput, VaultonomyCard } from "./Card";
import { Heading } from "./Heading";
import { PositionProgressLine, ProgressLineContainer } from "./ProgressLine";
import { SendMessageStep } from "./SendMessageStep";
import { useExpandCollapseElement } from "./hooks/useExpandCollapseElement";
import { UseRedditAccountResult } from "./hooks/useRedditAccount";
import { UseRedditAccountActiveVaultResult } from "./hooks/useRedditAccountActiveVault";
import { ExpandMoreIcon40 } from "./icons";
import { PAIRING_MESSAGE } from "./ids";
import { ConnectWalletStep } from "./pairing-steps/ConnectWalletStep";
import { FetchPairingMessageStep } from "./pairing-steps/FetchPairingMessageStep";
import { SignMessageStep } from "./pairing-steps/SignMessageStep";
import { PairingStep, StepBody } from "./pairing-steps/components";
import { PairingId } from "./state/createVaultonomyStore";
import { getPairingId, usePairingState } from "./state/usePairingState";
import { useVaultonomyStore } from "./state/useVaultonomyStore";

export function Pairing({
  redditAccount,
  activeVault,
  wallet,
}: {
  redditAccount: UseRedditAccountResult;
  activeVault: UseRedditAccountActiveVaultResult;
  wallet: UseAccountReturnType;
}): JSX.Element {
  const hasNoActiveVault = activeVault.data === null;
  const [pairingInterest, setPairingInterest] = useVaultonomyStore((s) => [
    s.pairingInterest,
    s.setPairingInterest,
  ]);
  const pairingId = getPairingId({
    userId: redditAccount.data?.userID,
    vaultAddress:
      // null means no active vault, undefined means not loaded
      activeVault.data === null ? null : activeVault.data?.address,
    walletAddress: wallet.address,
  });
  const fetchedPairingMessage = usePairingState(
    pairingId,
    ({ pairing }) => pairing.fetchedPairingMessage,
  );
  const pairingMessage = useNormalisedPairingMessage(
    fetchedPairingMessage?.value,
  );

  return (
    <ExpandingNonModalDialog
      sectionLabel="Pair Wallet with Reddit"
      dialogLabel="Pair Wallet with Reddit"
      heading={
        <Heading className="text-center">
          {hasNoActiveVault ?
            <>“I want a Vault for my account…”</>
          : <>“I want to change my Vault…”</>}
        </Heading>
      }
      expanded={!!(pairingInterest === "interested")}
      onExpand={() => setPairingInterest("interested")}
      onCollapse={() => setPairingInterest("disinterested")}
    >
      <div className="mx-10 my-8 gap-16 flex flex-col justify-center items-center">
        {/* <Heading className="text-center">Pair Wallet with Reddit</Heading> */}
        <PairingNarrative
          redditUserName={redditAccount.data?.username}
          hasNoActiveVault={hasNoActiveVault}
        />
        <PairingSteps
          wallet={wallet}
          activeVault={activeVault}
          redditAccount={redditAccount}
          pairingId={pairingId}
          normalisedPairingMessage={pairingMessage?.normalisedPairingMessage}
        />
        {pairingMessage?.messageFields ?
          <PairingMessage message={pairingMessage.messageFields} />
        : undefined}
        {/* <PairingMessage
          message={{
            domain: {
              name: "reddit",
              chainId: "1",
              version: "1",
              salt: "reddit-sIvILoedIcisHANTEmpE",
            },
            message: {
              address: "0x5318810BD26f9209c3d4ff22891F024a2b0A739a",
              redditUser: "superbadger",
              expiresAt: new Date("2023-02-18T06:20:47"),
              nonce:
                "3afeac718855f79a1052384582f3e7bff7c8606d5e225c00db9db977897d5d04",
            },
          }}
        /> */}
      </div>
    </ExpandingNonModalDialog>
  );
}

function useNormalisedPairingMessage(
  rawPairingMessage: RedditEIP712Challenge | undefined,
):
  | {
      messageFields: RedditVaultPairingMessageFields;
      normalisedPairingMessage: NormalisedRedditEIP712Challenge;
    }
  | undefined {
  return useMemo(() => {
    if (!rawPairingMessage) return undefined;
    const normalisedPairingMessage =
      normaliseRedditChallenge(rawPairingMessage);
    const messageFields = challengeAsPairingMessageFields(
      normalisedPairingMessage,
    );
    return { normalisedPairingMessage, messageFields };
  }, [rawPairingMessage]);
}

/**
 * An expand/collapse area containing an non-modal dialog when expanded.
 */
function ExpandingNonModalDialog({
  sectionLabel,
  dialogLabel,
  heading,
  children,
  expanded: initiallyExpanded,
  onExpand,
  onCollapse,
}: {
  sectionLabel: string;
  dialogLabel: string;
  heading: ReactElement;
  children?: ReactElement;
  expanded?: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
}): JSX.Element {
  const bodyEl = useRef<HTMLDivElement>(null);

  const { toggleExpansion, transitionEnd, isExpanded } =
    useExpandCollapseElement({
      el: bodyEl.current,
      initiallyExpanded,
    });

  const idleBgClasses =
    isExpanded ?
      "bg-neutral-100 dark:bg-neutral-850"
    : "bg-neutral-50 dark:bg-neutral-900";

  return (
    <section
      aria-label={sectionLabel}
      className={[
        "border-b transition-backgroundColor duration-700",
        "border-neutral-200  border-b-neutral-300",
        "dark:border-neutral-800  dark:border-b-neutral-750",
        idleBgClasses,
        ,
      ].join(" ")}
    >
      <div>
        <button
          type="button"
          role="switch"
          aria-checked={isExpanded}
          className={[
            "w-full flex flex-row items-center transition-colors",
            idleBgClasses,
            "hover:bg-neutral-25 dark:hover:bg-neutral-875",
            "active:bg-white dark:active:bg-neutral-850",
            "border-t border-b",
            isExpanded ? "" : "-mb-[1px]", // hide the closed parent's border under the button
            "border-neutral-200  border-b-neutral-300",
            "dark:border-neutral-800  dark:border-b-neutral-750",
            "border-collapse hover:border-neutral-300  hover:border-b-neutral-400 dark:hover:border-neutral-750 dark:hover:border-b-neutral-700",
          ].join(" ")}
          onClick={() => {
            toggleExpansion();
            if (isExpanded) onCollapse && onCollapse();
            else onExpand && onExpand();
          }}
        >
          <div className="flex-grow ml-28">{heading}</div>
          <ExpandMoreIcon40
            className={[
              "flex-shrink m-6 w-16 transition-transform duration-700",
              isExpanded ? "rotate-0" : "-rotate-90",
            ].join(" ")}
          />
        </button>
      </div>
      <div
        role="dialog"
        aria-label={dialogLabel}
        aria-hidden={!isExpanded}
        ref={bodyEl}
        onTransitionEnd={transitionEnd}
        className="transition-[height] duration-700 overflow-hidden"
      >
        {children}
      </div>
    </section>
  );
}

function PairingNarrative({
  redditUserName: _redditUserName,
  hasNoActiveVault,
}: {
  redditUserName: string | undefined;
  hasNoActiveVault: boolean | undefined;
}): JSX.Element {
  const redditUserName = (_redditUserName ?? "Unknown").toUpperCase();
  const headingId = useId();
  return (
    <aside
      aria-labelledby={headingId}
      className="grid grid-cols-[auto_1fr] max-w-prose gap-x-4 gap-y-2"
    >
      <Heading id={headingId} level={3} className="text-center col-span-2">
        The Pairing Process
      </Heading>
      {/* <div className="col-span-2">
        <h3 className="text-center text-xl">Act 1</h3>
        <h4 className="text-center text-l">Scene 1</h4>
      </div> */}
      <Setting>Somewhere on the Internet, present day.</Setting>
      <Stage>
        {redditUserName}, a Reddit user, is talking to REDDIT with the help of
        VAULTONOMY.
      </Stage>
      <Dialogue name={redditUserName}>
        “
        {hasNoActiveVault ?
          <>I want a Vault for my account.</>
        : <>I want to change my Vault Address.</>}{" "}
        But I’m not giving you my seed phrase, I’ve got my own Wallet…”
      </Dialogue>
      <Dialogue name="REDDIT">
        “OK. But I need to be sure the new Address is yours. If you can sign my
        Pairing Message containing your Username and Address and send it back to
        me, I’ll make it your Vault.”
      </Dialogue>
      <Dialogue name="VAULTONOMY">
        “I'm mediate between your Wallet and Reddit to get you a Vault using
        your Wallet's Address. Follow these steps and we'll have your Wallet
        paired as your Vault in no time!”
      </Dialogue>
      {/* <Dialogue name="VAULTONOMY">
        “The message Reddit needs you to sign is below. When you’re ready, hit{" "}
        <em>Pair Wallet</em> and sign the message with your Wallet. Then I’ll
        pass it on to Reddit, and your Wallet’s address will become your Vault
        Address too.”
      </Dialogue> */}
    </aside>
  );
}

function Setting({ children }: { children: ReactNode }): JSX.Element {
  // return (
  //   <>
  //     <div className="col-start-1 text-right font-medium">Setting:</div>{" "}
  //     <div className="col-start-2 w-2/3 justify-self-end">{children}</div>
  //   </>
  // );
  return <div className="col-span-2 my-1 font-light">{children}</div>;
}

function Stage({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="col-span-2 my-1 ml-8 italic font-light">{children}</div>
  );
}

function Dialogue({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="col-span-2">
      <div className="text-center font-medium">{name}</div>
      <p className="prose">{children}</p>
    </div>
  );
  // return (
  //   <>
  //     <div className="col-start-1 text-right font-medium">{name}</div>{" "}
  //     <div className="col-start-2">{children}</div>
  //   </>
  // );
}

function PairingSteps({
  redditAccount,
  wallet,
  activeVault,
  pairingId,
  normalisedPairingMessage,
}: {
  redditAccount: UseRedditAccountResult;
  activeVault: UseRedditAccountActiveVaultResult;
  wallet: UseAccountReturnType;
  pairingId: PairingId | undefined;
  normalisedPairingMessage: NormalisedRedditEIP712Challenge | undefined;
}): JSX.Element {
  return (
    <>
      <main aria-label="Pairing Steps" className="relative max-w-[34rem]">
        <ProgressLineContainer>
          <PositionProgressLine />
          <div className="z-10 relative grid grid-cols-[2rem_1fr] gap-x-2 gap-y-2">
            {/* <PairingStep num={1} name="Connect Wallet" state="past">
              <StepAction state="done">Wallet connected</StepAction>
            </PairingStep> */}
            <ConnectWalletStep
              redditAccount={redditAccount}
              wallet={wallet}
              activeVault={activeVault}
            />

            <FetchPairingMessageStep
              pairingId={pairingId}
              address={wallet.address}
              redditUserName={redditAccount?.data?.username}
              activeVault={activeVault}
            />

            <SignMessageStep
              pairingId={pairingId}
              address={wallet.address}
              walletChainId={wallet.chainId}
              challenge={normalisedPairingMessage}
            />

            <SendMessageStep
              pairingId={pairingId}
              challenge={normalisedPairingMessage}
            />

            <PairingStep num={5} name="All done!" state="future">
              <StepBody className="grid grid-cols-[1fr_auto] gap-x-4 mb-6">
                <p className="mb-6 col-span-2">
                  Nice job. To celebrate your{" "}
                  <em className="">Vault's autonomy</em> you can mint a
                  commemorative Vaultonomy Card for your Reddit username. A
                  token of your appreciation.
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
                            <a
                              className="underline underline-offset-2 text-blue-500"
                              target="_blank"
                              href="https://vaultonomy.eth.link/cards"
                            >
                              https://vaultonomy.eth.link/cards
                            </a>
                          </li>
                          <li>Your Wallet as an NFT (e.g. OpenSea)</li>
                        </ul>
                      </li>
                      <li className="my-2">
                        Pay what you like — your card's number is its rank by
                        price, updated in real time. Proceeds go to Vaultonomy
                        development.
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
                      className="my-4 mb-[0.8rem] w-full justify-self-end"
                    >
                      Mint
                    </Button>
                  </div>
                </aside>
                <VaultonomyCard className="self-center" />
              </StepBody>
            </PairingStep>
          </div>
        </ProgressLineContainer>
      </main>
    </>
  );
}

interface RedditVaultPairingMessageFields {
  domain: {
    name: string;
    chainId: string;
    version: string;
    salt: string;
  };
  message: {
    address: Address;
    redditUser: string;
    expiresAt: Date;
    nonce: string;
  };
}

function challengeAsPairingMessageFields(
  challenge: NormalisedRedditEIP712Challenge,
): RedditVaultPairingMessageFields {
  return {
    domain: {
      name: challenge.domain.name,
      chainId: `${Number(challenge.domain.chainId)}`,
      version: challenge.domain.version,
      salt: challenge.domain.salt,
    },
    message: {
      address: challenge.message.address,
      redditUser: challenge.message.redditUserName,
      expiresAt: new Date(challenge.message.expiresAt),
      nonce: challenge.message.nonce,
    },
  };
}

function PairingMessage({
  message,
}: {
  message: RedditVaultPairingMessageFields;
}): JSX.Element {
  const headingId = PAIRING_MESSAGE;
  return (
    <aside aria-labelledby={headingId} className="">
      <div className="max-w-prose mx-auto">
        <Heading id={headingId} level={3} className="text-center mt-0">
          Reddit’s Message
        </Heading>
        <div className="prose">
          {/* TODO: maybe more info here. Allow viewing/copying the typed data?  */}
          <p>
            Your Wallet should show you these fields when you sign the Message.
          </p>
        </div>
      </div>
      <div className="flex flex-row flex-wrap justify-center gap-x-40 gap-y-20">
        <PairingMessageSection
          name="Domain"
          explanation="The Domain is the recipient of the Message you’re signing. (Like the payee on a bank cheque.) It stops your message being used in a way you don't expect — it's only for Reddit."
        >
          <PairingMessageField
            name="Name"
            explanation="You’re signing a message for Reddit."
            value={message.domain.name}
          />
          <PairingMessageField
            name="Chain ID"
            explanation="The message is related to the Ethereum blockchain."
            value={message.domain.chainId}
          />
          <PairingMessageField
            name="Version"
            explanation="This is the first version of the message format."
            value={message.domain.version}
          />
          <PairingMessageField
            name="Salt"
            explanation="Some gibberish to make the Domain even more specific."
            value={opaqueUnpronounceableValue(message.domain.salt)}
          />
        </PairingMessageSection>
        <PairingMessageSection
          name="Message"
          explanation="You’re sending this Message to Reddit to prove that you’re in control of this Wallet Address, and that you want to make it your Vault Address."
        >
          <PairingMessageField
            name="Address"
            explanation="The Address you want to become your Vault Address.
          Also the Address of the Wallet you’re signing with."
            value={hexDigitsUnpronounceableValue(message.message.address)}
          />
          <PairingMessageField
            name="Reddit User"
            explanation="You’re changing the Vault Address of this user."
            value={message.message.redditUser}
          />
          <PairingMessageField
            name="Expires At"
            explanation="Reddit won’t accept this Message after this time (to stop the Message being kept and used in the future.)"
            value={message.message.expiresAt}
          />
          <PairingMessageField
            name="Nonce"
            explanation="Some random gibberish to make this Message unique and stop it being used twice."
            value={opaqueUnpronounceableValue(message.message.nonce)}
          />
        </PairingMessageSection>
      </div>
    </aside>
  );
}

function PairingMessageSection({
  name,
  explanation,
  children,
}: {
  name: string;
  explanation: string;
  children: ReactNode;
}): JSX.Element {
  const headingId = useId();
  return (
    <dl
      aria-labelledby={headingId}
      className="grid grid-cols-[auto_1fr] gap-4 max-w-prose"
    >
      <div className="col-start-2">
        <dt>
          <Heading id={headingId} level={4} className="my-2">
            {name}
          </Heading>
          {/* <h3 className="text-3xl font-semibold">{name}</h3> */}
        </dt>
        <dd className="font-light text-sm">{explanation}</dd>
      </div>
      {children}
    </dl>
  );
}

function hexDigitsUnpronounceableValue(address: Address): OpaqueValue {
  return {
    label: "unpronounceable hexadecimal digits",
    tokens: Array.from(address.substring(2)),
    raw: address,
  };
}

function opaqueUnpronounceableValue(token: string): OpaqueValue {
  return {
    label: "unpronounceable characters",
    tokens: Array.from(token),
    raw: token,
  };
}

interface OpaqueValue {
  label: string;
  tokens: ReadonlyArray<string>;
  raw: string;
}

function PairingMessageField({
  name,
  value,
  explanation,
}: {
  name: string;
  value: string | Date | OpaqueValue;
  explanation: string;
}): JSX.Element {
  let valueNode: ReactNode;
  if (typeof value === "string") {
    valueNode = <p className="text-2xl">{value}</p>;
  } else if (value instanceof Date) {
    valueNode = <p className="text-2xl">{value.toString()}</p>;
  } else {
    valueNode = (
      <>
        <div aria-label={value.label} className="sr-only">
          <p>{value.raw}</p>
          <ol aria-label="characters">
            {Array.from(value.tokens).map((token, i) => (
              <li key={i}>{token}</li>
            ))}
          </ol>
        </div>
        <p aria-hidden="true" className="text-2xl break-all">
          {value.raw}
        </p>
      </>
    );
  }

  return (
    <>
      <dt className="text-2xl font-semibold min-w-[4rem] justify-self-end">
        {name}
      </dt>
      <dd className="">
        {valueNode}
        <p role="note" className="font-light text-sm">
          {explanation}
        </p>
      </dd>
    </>
  );
}
