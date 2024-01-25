import { ReactNode } from "react";
import { Address } from "viem";

import { assert } from "../assert";
import { Button } from "./Button";
import { Heading } from "./Heading";
import { useVaultonomyStore } from "./state/useVaultonomyStore";

export function Pairing(): JSX.Element {
  const expressInterestInPairing = useVaultonomyStore(
    (s) => s.expressInterestInPairing,
  );
  const intendedPairingState = useVaultonomyStore(
    (s) => s.intendedPairingState,
  );

  if (intendedPairingState.userState === "disinterested") {
    return (
      <div className="mx-10 my-20 flex flex-col justify-center items-center">
        <Button onClick={expressInterestInPairing}>
          Pair Wallet with Vault…
        </Button>
      </div>
    );
  }
  assert(intendedPairingState.userState === "interested");
  return (
    <>
      <div className="mx-10 my-20 flex flex-col justify-center items-center">
        <Heading className="text-center">Pair Wallet with Vault</Heading>
        <PairingNarrative />
        <Button>Sign Message & Pair Vault</Button>
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
    </>
  );
}

function PairingNarrative(): JSX.Element {
  return (
    <aside className="my-8 grid grid-cols-[auto_1fr] max-w-prose gap-x-4 gap-y-2">
      <div className="col-span-2">
        <h3 className="text-center text-xl">Act 1</h3>
        <h4 className="text-center text-l">Scene 1</h4>
      </div>
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
        “Here’s the message Reddit needs you to sign. When you’re ready, hit{" "}
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
  return (
    <section className="m-10">
      <div className="max-w-prose mx-auto">
        <Heading className="text-center">Reddit’s Message</Heading>
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
    </section>
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
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-4 max-w-prose">
      <div className="col-start-2">
        <dt>
          <h3 className="text-3xl font-semibold">{name}</h3>
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
