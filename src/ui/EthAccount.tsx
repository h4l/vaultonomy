import React, { ReactNode, useState } from "react";
import { Address } from "viem";
import { useEnsName } from "wagmi";

import {
  ActivityToolId,
  CollectablesToolId,
} from "../settings/address-activity-tools";
import { Heading } from "./Heading";
import { WithInlineHelp } from "./Help";
import { Link } from "./Link";
import { useVaultonomySettings } from "./hooks/useVaultonomySettings";
import {
  ArkhamLogo,
  AvatarDexIcon,
  BlockscanLogo,
  CopyIcon,
  DeBankLogo,
  DoneIcon,
  ErrorIcon,
  FirstMateLogo,
  MagicEdenIcon,
  NansenLogo,
  OpenSeaIcon,
  OpenSeaProIcon,
  RCAXMonochromeLogo,
  RaribleIcon,
  ZapperLogo,
} from "./icons";
import { useVaultonomyStoreSingle } from "./state/useVaultonomyStore";

export type AccountType =
  | "connected-vault"
  | "past-vault"
  | "connected-wallet"
  | "search-result-vault";

export function EthAccount({
  type,
  title,
  titleId,
  subtitle,
  ethAddress: _ethAddress,
  footer,
  children,
}: {
  type: AccountType;
  title: string;
  titleId?: string;
  subtitle?: string;
  ethAddress?: Address;
  head?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <EthAccountDetails
      type={type}
      title={title}
      ethAddress={_ethAddress}
      header={
        <Heading
          id={titleId ?? title.toLowerCase().replaceAll(/\s+/g, "-")}
          className={`row-start-1 col-start-1 col-span-6 flex flex-row justify-center`}
        >
          {subtitle ?
            <span className="relative">
              {title}
              <span
                role="note"
                className="inline-block absolute left-[0.625rem] -bottom-2 text-sm font-normal"
              >
                {subtitle}
              </span>
            </span>
          : title}
        </Heading>
      }
      footer={footer}
    >
      {children}
    </EthAccountDetails>
  );
}

export function EthAccountDetails({
  type,
  title,
  ethAddress: _ethAddress,
  header,
  footer,
  children,
}: {
  type: AccountType;
  title: string;
  ethAddress?: Address;
  header?: ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}): JSX.Element {
  const ensName = useEnsName({ address: _ethAddress });
  const ethAddress = _ethAddress ?? `0x${"0".repeat(40)}`;
  const isDisabled = _ethAddress === undefined;
  return (
    <section
      aria-label={`${title} details`}
      className="w-80 grid gap-x-4 gap-y-[0.125rem] auto-rows-min grid-cols-[auto_auto_auto_auto_auto_1fr] items-end"
    >
      {header}
      {ensName.data ?
        <WithInlineHelp
          className="row-start-2 col-start-2 col-span-5"
          helpText={`The primary ENS (Ethereum Name Service) name linked to this ${title}.`}
        >
          <p aria-label="ENS name" className="text-2xl">
            {/* TODO: should we link an ENS address to something? We could link to itself if it has a contenthash set. */}
            {ensName.data}
          </p>
        </WithInlineHelp>
      : undefined}
      <div
        aria-label={`Ethereum address`}
        className="row-start-3 text-4xl min-w-[4rem]"
      >
        <WithInlineHelp
          disabled={isDisabled}
          helpText={`The 0x… address that uniquely identifies this ${title}'s Ethereum account.`}
        >
          <span className="sr-only">
            {isDisabled ?
              `${title} is not connected yet. Information will be here after connecting.`
            : ethAddress}
          </span>
          <span
            aria-hidden="true"
            className={isDisabled ? "opacity-30" : undefined}
          >
            0x
          </span>
        </WithInlineHelp>
      </div>
      <EthAddressHexPairs ethAddress={_ethAddress} />
      {isDisabled ?
        undefined
      : <EthAddressActions
          accountType={type}
          title={title}
          ethAddress={ethAddress}
        />
      }
      {footer ?
        <div className="mt-1 row-start-7 col-start-2 col-span-5">{footer}</div>
      : undefined}
      {children ?
        <div className="row-start-8 col-start-1 col-span-6">{children}</div>
      : undefined}
    </section>
  );
}

export function EthAddressHexPairs({
  ethAddress: _ethAddress,
}: {
  ethAddress?: string;
}): JSX.Element {
  const ethAddress = _ethAddress ?? `0x${"0".repeat(40)}`;
  const isDisabled = _ethAddress === undefined;
  if (ethAddress.length != 42) {
    throw new Error(`address is not an Ethereum address`);
  }
  const hexPairs = [...Array(20).keys()].map((i) => {
    const col = 2 + (i % 5);
    const row = 3 + Math.floor(i / 5);
    return (
      <span
        key={i}
        aria-hidden="true"
        className={`row-start-${row} col-start-${col} text-2xl w-[1.4em] ${
          isDisabled ? "opacity-30" : ""
        }`}
      >
        {ethAddress.substring(i * 2 + 2, i * 2 + 4)}
      </span>
    );
  });
  return <>{hexPairs}</>;
  const _heyTailwindPleaseIncludeTheseDynamicallyCreatedClasses = (
    <template className="row-start-1 row-start-2 row-start-3 row-start-4 row-start-5 col-start-1 col-start-2 col-start-3 col-start-4 col-start-5 col-start-6" />
  );
}

function EthAddressActions({
  accountType,
  title,
  ethAddress,
}: {
  accountType: AccountType;
  title: string;
  ethAddress: Address;
}): JSX.Element {
  return (
    <>
      <WithInlineHelp
        className="row-start-4 self-start min-h-8"
        helpText={`Copy the ${title}'s 0x… address to the clipboard.`}
      >
        <CopyButton
          accountType={accountType}
          className="pt-[0.05rem]"
          iconClassName="w-full max-w-6 max-h-6"
          textToCopy={ethAddress}
        />
      </WithInlineHelp>
      <AddressActivityTool
        accountType={accountType}
        title={title}
        ethAddress={ethAddress}
      />
      <AddressCollectablesTool
        accountType={accountType}
        title={title}
        ethAddress={ethAddress}
      />
    </>
  );
}

export function FadeOut({ children }: { children?: ReactNode }): JSX.Element {
  return (
    <div className="relative z-10 -mt-32">
      <div
        className={[
          "h-24 bg-gradient-to-t",
          "from-neutral-50 via-neutral-50/80",
          "dark:from-neutral-900 dark:via-neutral-900/80",
          "via-50%",
        ].join(" ")}
      />
      <div className="bg-default min-h-4">{children}</div>
    </div>
  );
}

interface CopyState {
  overlayType: "done" | "failed";
  overlayState: "hidden" | "shown";
}

function CopyButton({
  accountType,
  className,
  iconClassName,
  textToCopy,
}: {
  accountType: AccountType;
  size?: number | string;
  className?: string;
  iconClassName?: string;
  textToCopy?: string;
}): JSX.Element {
  const isDisabled = textToCopy === undefined;
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [state, setState] = useState<CopyState>({
    overlayType: "done",
    overlayState: "hidden",
  });
  const stats = useVaultonomyStoreSingle((s) => s.stats);

  async function doCopy() {
    if (isDisabled) return;

    stats?.logEvent({
      name: "VT_ethAddress_copied",
      params: { account_type: accountType },
    });

    try {
      // FIXME: maybe remove this
      if (process.env.NODE_ENV === "development" && !window.isSecureContext) {
        console.warn(
          `Not copying text due to dev mode insecure context. textToCopy=${JSON.stringify(
            textToCopy,
          )}`,
        );
      } else {
        await navigator.clipboard.writeText(textToCopy);
      }
      setStatusMessage("copied to clipboard");
      setState({ overlayType: "done", overlayState: "shown" });
      setTimeout(
        () => setState({ overlayType: "done", overlayState: "hidden" }),
        1500,
      );
    } catch (e) {
      console.warn("failed to copy to clipboard:", e);
      setStatusMessage("failed to copy to clipboard");
      setState({ overlayType: "failed", overlayState: "shown" });
      setTimeout(
        () => setState({ overlayType: "failed", overlayState: "hidden" }),
        1500,
      );
    }
  }

  const overlayOpacity =
    state.overlayState === "shown" ? "opacity-100" : "opacity-0";

  let overlay: JSX.Element = <></>;
  if (state.overlayType === "done") {
    overlay = (
      <span aria-hidden="true">
        <DoneIcon
          size={24}
          className={`text-green-500 absolute top-0 left-0 duration-200 transition-opacity ${overlayOpacity} ${
            iconClassName || ""
          }`}
        />
      </span>
    );
  } else {
    overlay = (
      <ErrorIcon
        size={24}
        className={`text-red-500 absolute top-0 left-0 duration-200 transition-opacity ${overlayOpacity} ${
          iconClassName || ""
        }`}
      />
    );
  }

  return (
    <>
      <button
        aria-label={`Copy Ethereum address${
          statusMessage ? ` (${statusMessage})` : ""
        }`}
        aria-disabled={isDisabled || undefined}
        className={`relative ${className}`}
        onClick={doCopy}
        onBlur={() => setStatusMessage(undefined)}
      >
        <CopyIcon
          size={24}
          aria-label={statusMessage}
          className={`transition-opacity duration-200 ${
            state.overlayState === "shown" ? "opacity-5" : "opacity-100"
          } ${iconClassName}`}
        />
        {overlay}
      </button>
    </>
  );
}

function AddressActivityTool({
  accountType,
  title,
  ethAddress,
}: {
  accountType: AccountType;
  title: string;
  ethAddress: Address;
}): JSX.Element {
  const addressActivityTool = useVaultonomySettings({
    select: ({ preferences }) => preferences.addressActivityTool,
  });
  const stats = useVaultonomyStoreSingle((s) => s.stats);

  if (!addressActivityTool.data) return <></>;

  const tool = addressActivityTools[addressActivityTool.data];

  return (
    <WithInlineHelp
      className="row-start-5 self-start min-h-8"
      helpText={`View this ${title} on ${tool.label} to see its on-chain activity.`}
    >
      <Link
        href={tool.url(encodeURIComponent(ethAddress) as Address)}
        className="inline-block"
        onClick={() => {
          stats?.logEvent({
            name: "VT_ethAddress_toolUsed",
            params: {
              account_type: accountType,
              tool_name: addressActivityTool.data,
            },
          });
        }}
      >
        <span className="sr-only">
          View this {title} on {tool.label}
        </span>
        <span aria-hidden="true">
          <tool.icon className="w-full max-w-6 max-h-6 pt-[0.05rem]" />
        </span>
      </Link>
    </WithInlineHelp>
  );
}

function AddressCollectablesTool({
  accountType,
  title,
  ethAddress,
}: {
  accountType: AccountType;
  title: string;
  ethAddress: Address;
}): JSX.Element {
  const addressCollectablesTool = useVaultonomySettings({
    select: ({ preferences }) => preferences.addressCollectablesTool,
  });
  const stats = useVaultonomyStoreSingle((s) => s.stats);

  if (!addressCollectablesTool.data) return <></>;

  const tool = addressCollectablesTools[addressCollectablesTool.data];

  return (
    <WithInlineHelp
      className="row-start-6 self-start min-h-8"
      helpText={`View this ${title} on ${tool.label} to see the NFTs it holds.`}
    >
      <Link
        // href={openseaAddressDetailUrl(ethAddress)}
        href={tool.url(encodeURIComponent(ethAddress) as Address)}
        className="inline-block"
        onClick={() => {
          stats?.logEvent({
            name: "VT_ethAddress_toolUsed",
            params: {
              account_type: accountType,
              tool_name: addressCollectablesTool.data,
            },
          });
        }}
      >
        <span className="sr-only">
          View this {title} on {tool.label}
        </span>
        <span aria-hidden="true">
          <tool.icon className="w-full max-w-6 max-h-6 pt-[0.05rem]" />
        </span>
      </Link>
    </WithInlineHelp>
  );
}

type ToolDetails = {
  label: string;
  url: (address: Address) => `https://${string}`;
  icon: (options: { className?: string | undefined }) => JSX.Element;
};

const addressActivityTools: Record<ActivityToolId, ToolDetails> = {
  arkham: {
    label: "Arkham Intelligence Platform",
    url: (address) =>
      `https://platform.arkhamintelligence.com/explorer/address/${address}`,
    icon: ArkhamLogo,
  },
  blockscan: {
    label: "Blockscan",
    url: (address) => `https://blockscan.com/address/${address}`,
    icon: BlockscanLogo,
  },
  debank: {
    label: "DeBank",
    url: (address) => `https://debank.com/profile/${address}`,
    icon: DeBankLogo,
  },
  nansen: {
    label: "Nansen",
    url: (address) =>
      `https://app.nansen.ai/profiler?address=${address}&chain=all&tab=overview`,
    icon: NansenLogo,
  },
  zapper: {
    label: "Zapper",
    url: (address) => `https://zapper.xyz/account/${address}`,
    icon: ZapperLogo,
  },
};

const addressCollectablesTools: Record<CollectablesToolId, ToolDetails> = {
  avatardex: {
    label: "AvatarDex",
    url: (address) => `https://avatardex.io/${address}`,
    icon: AvatarDexIcon,
  },
  firstmate: {
    label: "FirstMate",
    url: (address) => `https://avatars.firstmate.xyz/address/${address}`,
    icon: FirstMateLogo,
  },
  magiceden: {
    label: "Magic Eden",
    url: (address) => `https://magiceden.io/u/${address}?chain=polygon`,
    icon: MagicEdenIcon,
  },
  opensea: {
    label: "OpenSea",
    url: (address) => `https://opensea.io/${address}`,
    icon: OpenSeaIcon,
  },
  "opensea-pro": {
    label: "OpenSea Pro",
    url: (address) => `https://pro.opensea.io/profile/${address}`,
    icon: OpenSeaProIcon,
  },
  rarible: {
    label: "Rarible",
    url: (address) => `https://rarible.com/user/${address}`,
    icon: RaribleIcon,
  },
  rcax: {
    label: "RCAX",
    url: (address) => `https://marketplace.rcax.io/portfolio/${address}`,
    icon: RCAXMonochromeLogo,
  },
};
