import {
  ReactElement,
  ReactNode,
  RefObject,
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { twMerge } from "tailwind-merge";
import { Address } from "viem";

import { assert } from "../assert";
import { log } from "../logging";
import { Button } from "./Button";
import { EthInput, VaultonomyCard } from "./Card";
import { Heading } from "./Heading";
import {
  PositionProgressLine,
  ProgressLineContainer,
  usePositionReachedBroadcast,
} from "./ProgressLine";
import { useExpandCollapseElement } from "./hooks/useExpandCollapseElement";
import { useVaultonomyStore } from "./state/useVaultonomyStore";

export function Pairing(): JSX.Element {
  const [
    intendedPairingState,
    expressInterestInPairing,
    expressDisinterestInPairing,
  ] = useVaultonomyStore((s) => [
    s.pairing_UserInterest,
    s.expressInterestInPairing,
    s.expressDisinterestInPairing,
  ]);

  return (
    <ExpandingNonModalDialog
      sectionLabel="Pair Wallet with Reddit"
      dialogLabel="Pair Wallet with Reddit"
      heading={
        <Heading className="text-center">“I want to change my Vault…”</Heading>
      }
      expanded={intendedPairingState === "interested"}
      onExpand={expressInterestInPairing}
      onCollapse={expressDisinterestInPairing}
    >
      <div className="mx-10 my-8 gap-16 flex flex-col justify-center items-center">
        {/* <Heading className="text-center">Pair Wallet with Reddit</Heading> */}
        <PairingNarrative />
        <PairingSteps />
        <PairingMessage
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
        />
      </div>
    </ExpandingNonModalDialog>
  );
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

  const { toggleExpansion, transitionEnd, isExpanded, isTransitioning } =
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
        "border-t border-b transition-backgroundColor duration-700",
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
            "border-b border-transparent",
            "border-collapse hover:border-neutral-300 hover:border-l-neutral-400 hover:border-b-neutral-400 dark:hover:border-neutral-750 dark:hover:border-l-neutral-700 dark:hover:border-b-neutral-700",
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

function PairingNarrative(): JSX.Element {
  const headingId = useId();
  return (
    <aside
      aria-labelledby={headingId}
      className="grid grid-cols-[auto_1fr] max-w-prose gap-x-4 gap-y-2"
    >
      <Heading id={headingId} level={3} className="text-center col-span-2">
        The pairing process
      </Heading>
      {/* <div className="col-span-2">
        <h3 className="text-center text-xl">Act 1</h3>
        <h4 className="text-center text-l">Scene 1</h4>
      </div> */}
      <Setting>Somewhere on the Internet, present day.</Setting>
      <Stage>
        SUPERBADGER, a Reddit user, is talking to REDDIT with the help of
        VAULTONOMY.
      </Stage>
      <Dialogue name="SUPERBADGER">
        “I want to change my Vault Address. But I’m not giving you my seed
        phrase, I’ve got my own Wallet…”
      </Dialogue>
      <Dialogue name="REDDIT">
        “OK. But I need to be sure the new Address is yours. If you can sign a
        message containing your Username and Address and send it back to me,
        I’ll make it your Vault.”
      </Dialogue>
      <Dialogue name="VAULTONOMY">
        “The message Reddit needs you to sign is below. When you’re ready, hit{" "}
        <em>Pair Wallet</em> and sign the message with your Wallet. Then I’ll
        pass it on to Reddit, and your Wallet’s address will become your Vault
        Address too.”
      </Dialogue>
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

function PairingSteps(): JSX.Element {
  return (
    <>
      <main aria-label="Pairing Steps" className="relative max-w-[34rem]">
        <ProgressLineContainer>
          <PositionProgressLine />
          <div className="z-10 relative grid grid-cols-[2rem_1fr] gap-x-2 gap-y-2">
            <PairingStep num={1} name="Connect Wallet" state="past">
              <StepAction state="done">Wallet connected</StepAction>
            </PairingStep>

            <PairingStep num={2} name="Fetch Pairing Message" state="past">
              <StepAction state="error">
                {/* Wallet pairing message fetched from Reddit */}
                Failed to fetch pairing message from Reddit
              </StepAction>
            </PairingStep>

            <PairingStep num={3} name="Review & Sign Message" state="present">
              <StepBody>
                <p className="mb-4">
                  Reddit's Vault pairing message is below. Sign it with your
                  Wallet to prove to Reddit that you own your Wallet's address,
                  and that you wish to make it your Vault address.
                </p>
                <Button size="l" className="block m-4">
                  Sign Message
                </Button>
              </StepBody>
              {/* <StepAction state="done">Message signed</StepAction> */}
              <StepAction state="pending">
                Awaiting signature from Wallet…
              </StepAction>
            </PairingStep>

            <PairingStep num={4} name="Send Pairing Request" state="future">
              <StepAction state="done">Message sent</StepAction>
              <StepAction state="done">Wallet paired as your Vault</StepAction>
            </PairingStep>

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

function PairingStep({
  num,
  name,
  state,
  children,
}: {
  num: number;
  name: string;
  state: "past" | "present" | "future";
  children?: ReactElement | ReactElement[];
}): JSX.Element {
  const textTwClasses =
    state === "future" ? "text-neutral-500 dark:text-neutral-500" : undefined;
  const progressPosition = useRef<HTMLSpanElement>(null);

  usePositionReachedBroadcast({
    isReached: state !== "past",
    position: progressPosition,
  });

  return (
    <>
      <span
        ref={progressPosition}
        className={twMerge(
          "pl-2 clip-pairing-step-number",
          "mt-6 mb-2 text-4xl font-semibold justify-self-center",
          "bg-neutral-100 dark:bg-neutral-850",
          textTwClasses,
        )}
      >
        {num}.
      </span>
      <Heading level={3} className={twMerge("mt-6 mb-2", textTwClasses)}>
        {name}
      </Heading>
      {children}
    </>
  );
}

function StepBody({
  className,
  children,
}: {
  className?: string;
  children: ReactElement | ReactElement[];
}): JSX.Element {
  return <div className={twMerge("col-start-2", className)}>{children}</div>;
}

const StepActionIcons = {
  done: DoneIcon,
  pending: PendingIcon,
  error: ErrorIcon,
};

function StepAction({
  state,
  children,
}: {
  state: "done" | "pending" | "error";
  children?: ReactElement | string;
}): JSX.Element {
  const Icon = StepActionIcons[state];
  return (
    <>
      <span className="py-[0.125rem] justify-self-center bg-neutral-100 dark:bg-neutral-850">
        <Icon
          size={24}
          className={
            state === "pending" ? "animate-beat text-neutral-700" : undefined
          }
        />
      </span>
      <div
        className={twMerge(
          "mt-1",
          state === "error" ?
            "underline underline-offset-4 decoration-wavy decoration-red-500"
          : undefined,
        )}
      >
        {children}
      </div>
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

function PairingMessage({
  message,
}: {
  message: RedditVaultPairingMessageFields;
}): JSX.Element {
  const headingId = useId();
  return (
    <aside aria-labelledby={headingId} className="">
      <div className="max-w-prose mx-auto">
        <Heading id={headingId} level={3} className="text-center mt-0">
          Reddit’s Message
        </Heading>
        <div className="prose">
          {/* TODO: maybe more info here. Allow viewing/copying the typed data?  */}
          <p></p>
        </div>
      </div>
      <div className="flex flex-row flex-wrap justify-center gap-x-40 gap-y-20">
        <PairingMessageSection
          name="Domain"
          explanation="The Domain is the recipient of the Message you’re signing. (Like the payee on a bank cheque.) It stops your message being re-used."
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

function SvgIcon({
  title,
  className,
  size: _size,
  icon24,
  icon40,
}: {
  title: string;
  size?: number;
  className?: string;
  icon24?: ReactElement;
  icon40: ReactElement;
}): JSX.Element {
  const size = _size ?? 40;
  const icon = size < 30 ? icon24 ?? icon40 : icon40;
  return (
    <svg
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      width={size}
    >
      <title>{title}</title>
      {icon}
    </svg>
  );
}

function ExpandMoreIcon40(props: {
  size?: number;
  className?: string;
}): JSX.Element {
  return (
    // https://fonts.google.com/icons?selected=Material%20Symbols%20Outlined%3Aexpand_more%3AFILL%400%3Bwght%40400%3BGRAD%400%3Bopsz%4040
    <SvgIcon
      title="Expand More"
      {...props}
      icon40={
        <path
          fill="currentColor"
          d="M480-345 240-585l47.333-47.333L480-438.999l192.667-192.667L720-584.333 480-345Z"
        />
      }
    />
  );
}

function DoneIcon(props: { size?: number; className?: string }): JSX.Element {
  return (
    // https://fonts.google.com/icons?selected=Material%20Symbols%20Outlined%3Atask_alt%3AFILL%400%3Bwght%40400%3BGRAD%400%3Bopsz%4040
    <SvgIcon
      title="Done"
      {...props}
      icon24={
        <path
          fill="currentColor"
          d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q65 0 123 19t107 53l-58 59q-38-24-81-37.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160q133 0 226.5-93.5T800-480q0-18-2-36t-6-35l65-65q11 32 17 66t6 70q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm-56-216L254-466l56-56 114 114 400-401 56 56-456 457Z"
        />
      }
      icon40={
        <path
          fill="currentColor"
          d="M480-80q-84.333 0-157.333-30.833-73-30.834-127-84.834t-84.834-127Q80-395.667 80-480q0-83.667 30.833-156.667 30.834-73 84.834-127t127-85.166Q395.667-880 480-880q71.667 0 134.334 22.333Q677-835.333 728.001-796l-48 48.333q-42-31.333-92.334-48.5Q537.334-813.334 480-813.334q-141 0-237.167 96.167T146.666-480q0 141 96.167 237.167T480-146.666q141 0 237.167-96.167T813.334-480q0-26-3.667-51-3.667-25.001-11-48.668L851-632q14.333 35.333 21.667 73.333Q880-520.667 880-480q0 84.333-31.167 157.333-31.166 73-85.166 127t-127 84.834Q563.667-80 480-80Zm-58-217.333L255.333-464.667 304-513.333l118 118L831.334-805l49.333 48.667-458.667 459Z"
        />
      }
    />
  );
}

function ErrorIcon(props: { size?: number; className?: string }): JSX.Element {
  return (
    // https://fonts.google.com/icons?selected=Material%20Symbols%20Outlined%3Aerror%3AFILL%400%3Bwght%40400%3BGRAD%400%3Bopsz%4040
    <SvgIcon
      title="Error"
      {...props}
      icon24={
        <path
          fill="currentColor"
          d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"
        />
      }
      icon40={
        <path
          fill="currentColor"
          d="M479.988-280q15.012 0 25.179-10.155 10.166-10.155 10.166-25.167 0-15.011-10.155-25.178-10.155-10.166-25.166-10.166-15.012 0-25.179 10.155-10.166 10.154-10.166 25.166t10.155 25.178Q464.977-280 479.988-280Zm-31.321-155.333h66.666V-684h-66.666v248.667ZM480.177-80q-82.822 0-155.666-31.5t-127.178-85.833Q143-251.667 111.5-324.56 80-397.454 80-480.333q0-82.88 31.5-155.773Q143-709 197.333-763q54.334-54 127.227-85.5Q397.454-880 480.333-880q82.88 0 155.773 31.5Q709-817 763-763t85.5 127Q880-563 880-480.177q0 82.822-31.5 155.666T763-197.456q-54 54.21-127 85.833Q563-80 480.177-80Zm.156-66.666q139 0 236.001-97.334 97-97.333 97-236.333t-96.875-236.001q-96.876-97-236.459-97-138.667 0-236 96.875Q146.666-619.583 146.666-480q0 138.667 97.334 236 97.333 97.334 236.333 97.334ZM480-480Z"
        />
      }
    ></SvgIcon>
  );
}

function PendingIcon(props: {
  size?: number;
  className?: string;
}): JSX.Element {
  return (
    // https://fonts.google.com/icons?selected=Material%20Symbols%20Outlined%3Apending%3AFILL%400%3Bwght%40400%3BGRAD%400%3Bopsz%4040
    <SvgIcon
      title="Pending"
      {...props}
      icon24={
        <path
          fill="currentColor"
          d="M280-420q25 0 42.5-17.5T340-480q0-25-17.5-42.5T280-540q-25 0-42.5 17.5T220-480q0 25 17.5 42.5T280-420Zm200 0q25 0 42.5-17.5T540-480q0-25-17.5-42.5T480-540q-25 0-42.5 17.5T420-480q0 25 17.5 42.5T480-420Zm200 0q25 0 42.5-17.5T740-480q0-25-17.5-42.5T680-540q-25 0-42.5 17.5T620-480q0 25 17.5 42.5T680-420ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"
        />
      }
      icon40={
        <path
          fill="currentColor"
          d="M270.745-426.667q22.255 0 37.755-15.578 15.5-15.579 15.5-37.833 0-22.255-15.579-37.755-15.578-15.5-37.833-15.5t-37.755 15.578q-15.5 15.579-15.5 37.833 0 22.255 15.579 37.755 15.578 15.5 37.833 15.5Zm209.333 0q22.255 0 37.755-15.578 15.5-15.579 15.5-37.833 0-22.255-15.578-37.755-15.579-15.5-37.833-15.5-22.255 0-37.755 15.578-15.5 15.579-15.5 37.833 0 22.255 15.578 37.755 15.579 15.5 37.833 15.5Zm208.667 0q22.255 0 37.755-15.578 15.5-15.579 15.5-37.833 0-22.255-15.578-37.755-15.579-15.5-37.833-15.5-22.255 0-37.755 15.578-15.5 15.579-15.5 37.833 0 22.255 15.578 37.755 15.579 15.5 37.833 15.5ZM480.177-80q-82.822 0-155.666-31.5t-127.178-85.833Q143-251.667 111.5-324.56 80-397.454 80-480.333q0-82.88 31.5-155.773Q143-709 197.333-763q54.334-54 127.227-85.5Q397.454-880 480.333-880q82.88 0 155.773 31.5Q709-817 763-763t85.5 127Q880-563 880-480.177q0 82.822-31.5 155.666T763-197.456q-54 54.21-127 85.833Q563-80 480.177-80Zm.156-66.666q139 0 236.001-97.334 97-97.333 97-236.333t-96.875-236.001q-96.876-97-236.459-97-138.667 0-236 96.875Q146.666-619.583 146.666-480q0 138.667 97.334 236 97.333 97.334 236.333 97.334ZM480-480Z"
        />
      }
    />
  );
}
