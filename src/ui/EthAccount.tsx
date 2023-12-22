import React from "react";

export function EthAccount({
  ethAddress,
  ensName,
  header,
  footer,
}: {
  ethAddress: string;
  ensName?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="grid gap-x-8 grid-cols-[auto_1fr]">
      {header ? (
        <div key="0" className="row-start-1 col-start-2">
          {header}
        </div>
      ) : undefined}
      {ensName ? (
        <span key="1" className="row-start-2 col-start-2 text-xl">
          {ensName}
        </span>
      ) : undefined}
      <span key="3" className="row-start-3 text-4xl">
        0x
      </span>
      <EthAddressHexPairs
        key="4"
        className="row-start-3 text-xl"
        ethAddress={ethAddress}
      />
      {footer ? (
        <div key="5" className="row-start-4 col-start-2">
          {footer}
        </div>
      ) : undefined}
    </div>
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
    <span key={i}>{ethAddress.substring(i * 2 + 2, i * 2 + 4)}</span>
  ));
  return (
    <div className={`grid grid-cols-5 ${className || ""}`}>{hexPairs}</div>
  );
}
