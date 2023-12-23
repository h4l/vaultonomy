import React, { useId } from "react";

import { Heading } from "./Heading";

export function EthAccount({
  title,
  ethAddress,
  ensName,
  footer,
}: {
  title: string;
  ethAddress: string;
  ensName?: string;
  footer?: React.ReactNode;
}): JSX.Element {
  return (
    <section className="grid gap-x-8 grid-cols-[auto_1fr]">
      <Heading className="row-start-1 col-start-2">{title}</Heading>
      {ensName ? (
        <p className="row-start-2 col-start-2 text-xl" title="">
          <span className="sr-only">ENS name: </span>
          {ensName}
        </p>
      ) : undefined}
      {/* Negative top margin is a slight hack to make the 0x baseline align
          with the first hex digit row. */}
      <span className="row-start-3 text-4xl -mt-2" aria-hidden="true">
        0x
      </span>
      <EthAddressHexPairs
        className="row-start-3 text-xl"
        ethAddress={ethAddress}
      />
      {footer ? (
        <div className="row-start-4 col-start-2">{footer}</div>
      ) : undefined}
    </section>
  );
}

export function EthAddressHexPairs({
  ethAddress,
  className,
}: {
  ethAddress: string;
  className?: string;
}): JSX.Element {
  if (ethAddress.length != 42) {
    throw new Error(`address is not an Ethereum address`);
  }
  const hexPairs = [...Array(20).keys()].map((i) => (
    <span key={i} _aria-hidden="true">
      {ethAddress.substring(i * 2 + 2, i * 2 + 4)}
    </span>
  ));
  return (
    <div role="document" className={className}>
      <p className="sr-only">Ethereum address: {ethAddress}</p>
      <div aria-hidden="true" className="grid grid-cols-5">
        {hexPairs}
      </div>
    </div>
  );
}
