import React, { useId, useState } from "react";

import { Heading } from "./Heading";
import { WithInlineHelp } from "./Help";
import { Link } from "./Link";

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
    <section
      aria-label={`${title} Ethereum address details`}
      className="grid gap-x-4 gap-y-[0.125rem] grid-cols-[auto_auto_auto_auto_auto_1fr] items-end"
    >
      <Heading className="row-start-1 col-start-2 col-span-5">{title}</Heading>
      {ensName ? (
        <WithInlineHelp
          className="row-start-2 col-start-2 col-span-5"
          helpText={`The primary ENS (Ethereum Name Service) name linked to this ${title}.`}
        >
          <p aria-label="ENS name" className="text-2xl">
            {/* TODO: should we link an ENS address to something? We could link to itself if it has a contenthash set. */}
            {ensName}
          </p>
        </WithInlineHelp>
      ) : undefined}
      <div
        aria-label={`Ethereum address`}
        className="row-start-3 text-4xl min-w-[4rem]"
      >
        <WithInlineHelp
          helpText={`The 0x… address that uniquely identifies this ${title}'s Ethereum account.`}
        >
          <span className="sr-only">{ethAddress}</span>
          <span aria-hidden="true">0x</span>
        </WithInlineHelp>
      </div>
      <EthAddressHexPairs
        className="row-start-3 text-xl"
        ethAddress={ethAddress}
      />
      <EthAddressActions title={title} ethAddress={ethAddress} />
      {footer ? (
        <div className="row-start-7 col-start-2 col-span-5">{footer}</div>
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
  const hexPairs = [...Array(20).keys()].map((i) => {
    const col = 2 + (i % 5);
    const row = 3 + Math.floor(i / 5);
    return (
      <span
        key={i}
        aria-hidden="true"
        className={`row-start-${row} col-start-${col} text-2xl w-[1.4em]`}
      >
        {ethAddress.substring(i * 2 + 2, i * 2 + 4)}
      </span>
    );
  });
  return <>{hexPairs}</>;
  const heyTailwindPleaseIncludeTheseDynamicallyCreatedClasses = (
    <template className="row-start-1 row-start-2 row-start-3 row-start-4 row-start-5 col-start-1 col-start-2 col-start-3 col-start-4 col-start-5 col-start-6" />
  );
}

function EthAddressActions({
  title,
  ethAddress,
  className,
}: {
  title: string;
  ethAddress: string;
  className?: string;
}): JSX.Element {
  return (
    <>
      <WithInlineHelp
        className="row-start-4 self-start"
        helpText={`Copy the ${title}'s 0x… address to the clipboard.`}
      >
        <CopyButton
          className="mt-[0.05rem]"
          iconClassName="w-6"
          textToCopy={ethAddress}
        />
      </WithInlineHelp>
      <WithInlineHelp
        className="row-start-5 self-start"
        helpText={`View this ${title} on Etherscan to see its past activity.`}
      >
        <Link
          href={etherscanAddressDetailUrl(ethAddress)}
          className="inline-block"
        >
          <span className="sr-only">View this {title} on Etherscan</span>
          <EtherscanIcon className="w-6 mt-[0.05rem]" />
        </Link>
      </WithInlineHelp>
      <WithInlineHelp
        className="row-start-6 self-start"
        helpText={`View this ${title} on OpenSea to see the NFTs it holds.`}
      >
        <Link
          href={openseaAddressDetailUrl(ethAddress)}
          className="inline-block"
        >
          <span className="sr-only">View this {title} on OpenSea</span>
          <OpenSeaIcon className="w-6 mt-[0.05rem]" />
        </Link>
      </WithInlineHelp>
    </>
  );
}

function etherscanAddressDetailUrl(ethAddress: string): string {
  return `https://etherscan.io/address/${encodeURIComponent(ethAddress)}`;
}
function openseaAddressDetailUrl(ethAddress: string): string {
  return `https://opensea.io/${encodeURIComponent(ethAddress)}`;
}

interface CopyState {
  overlayType: "done" | "failed";
  overlayState: "hidden" | "shown";
}

function CopyButton({
  className,
  iconClassName,
  textToCopy,
}: {
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

  async function doCopy() {
    if (isDisabled) return;
    try {
      // FIXME: maybe remove this
      if (process.env.NODE_ENV === "development" && !window.isSecureContext) {
        console.warn(
          `Not copying text due to dev mode insecure context. textToCopy=${JSON.stringify(
            textToCopy
          )}`
        );
      } else {
        await navigator.clipboard.writeText(textToCopy);
      }
      setStatusMessage("copied to clipboard");
      setState({ overlayType: "done", overlayState: "shown" });
      setTimeout(
        () => setState({ overlayType: "done", overlayState: "hidden" }),
        1500
      );
    } catch (e) {
      console.warn("failed to copy to clipboard:", e);
      setStatusMessage("failed to copy to clipboard");
      setState({ overlayType: "failed", overlayState: "shown" });
      setTimeout(
        () => setState({ overlayType: "failed", overlayState: "hidden" }),
        1500
      );
    }
  }

  let overlayOpacity =
    state.overlayState === "shown" ? "opacity-100" : "opacity-0";

  let overlay: JSX.Element = <></>;
  if (state.overlayType === "done") {
    overlay = (
      <span aria-hidden="true">
        <DoneIcon
          className={`text-green-500 absolute top-0 left-0 duration-200 transition-opacity ${overlayOpacity} ${
            iconClassName || ""
          }`}
        />
      </span>
    );
  } else {
    overlay = (
      <ErrorIcon
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

function CopyIcon({
  className,
  size,
}: {
  size?: number | string;
  className?: string;
}): JSX.Element {
  return (
    // https://fonts.google.com/icons?selected=Material+Symbols+Outlined:content_copy:FILL@0;wght@400;GRAD@-25;opsz@24&icon.query=copy
    <svg
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      width={size}
    >
      <title>Copy</title>
      <path
        fill="currentColor"
        d="M355-240q-30.938 0-52.969-22.031Q280-284.062 280-315v-480q0-30.938 22.031-52.969Q324.062-870 355-870h360q30.938 0 52.969 22.031Q790-825.938 790-795v480q0 30.938-22.031 52.969Q745.938-240 715-240H355Zm0-75h360v-480H355v480ZM205-90q-30.938 0-52.969-22.031Q130-134.062 130-165v-555h75v555h435v75H205Zm150-225v-480 480Z"
      />
    </svg>
  );
}

function DoneIcon({
  className,
  size,
}: {
  size?: number | string;
  className?: string;
}): JSX.Element {
  return (
    // https://fonts.google.com/icons?selected=Material+Symbols+Outlined:done:FILL@0;wght@400;GRAD@-25;opsz@24&icon.query=done
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
    >
      <title>Done</title>
      <path
        fill="currentColor"
        d="M383-246 162-467l53.5-53.5L383-353l361.5-361.5L798-661 383-246Z"
      />
    </svg>
  );
}

function ErrorIcon({
  className,
  size,
}: {
  size?: number | string;
  className?: string;
}): JSX.Element {
  return (
    // https://fonts.google.com/icons?selected=Material+Symbols+Outlined:error:FILL@0;wght@400;GRAD@-25;opsz@24&icon.query=error
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
    >
      <title>Error</title>
      <path
        fill="currentColor"
        d="M479.895-285Q496-285 507-295.895q11-10.894 11-27Q518-339 507.105-350q-10.894-11-27-11Q464-361 453-350.105q-11 10.894-11 27Q442-307 452.895-296q10.894 11 27 11ZM443-440h75v-236h-75v236Zm37 350q-80.907 0-152.065-30.763-71.159-30.763-123.797-83.5Q151.5-257 120.75-328.087 90-399.175 90-480q0-80.907 30.763-152.065 30.763-71.159 83.5-123.797Q257-808.5 328.087-839.25 399.175-870 480-870q80.907 0 152.065 30.763 71.159 30.763 123.797 83.5Q808.5-703 839.25-631.913 870-560.825 870-480q0 80.907-30.763 152.065-30.763 71.159-83.5 123.797Q703-151.5 631.913-120.75 560.825-90 480-90Zm0-75q131.5 0 223.25-91.75T795-480q0-131.5-91.75-223.25T480-795q-131.5 0-223.25 91.75T165-480q0 131.5 91.75 223.25T480-165Zm0-315Z"
      />
    </svg>
  );
}

function EtherscanIcon({
  className,
  size,
}: {
  size?: number | string;
  className?: string;
}): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      viewBox="0 0 30 30"
    >
      <title>Etherscan</title>
      <g clipPath="url(#clip0_251_1386)">
        <path
          d="M6.23509 14.2833C6.23506 14.1158 6.26812 13.9499 6.33237 13.7952C6.39662 13.6405 6.4908 13.5 6.60949 13.3818C6.72818 13.2636 6.86904 13.17 7.02399 13.1064C7.17894 13.0428 7.34492 13.0105 7.51239 13.0113L9.63003 13.0182C9.96769 13.0182 10.2915 13.1524 10.5303 13.3913C10.769 13.6301 10.9031 13.954 10.9031 14.2918V22.3022C11.1417 22.2315 11.4476 22.1561 11.7828 22.0775C12.0155 22.0227 12.2229 21.8909 12.3714 21.7034C12.5198 21.5159 12.6006 21.2838 12.6007 21.0447V11.1084C12.6007 10.9412 12.6336 10.7755 12.6976 10.621C12.7615 10.4664 12.8553 10.326 12.9735 10.2077C13.0918 10.0894 13.2321 9.99559 13.3866 9.93157C13.5411 9.86754 13.7067 9.83458 13.8739 9.83457H15.9957C16.3334 9.83462 16.6571 9.96882 16.8959 10.2076C17.1346 10.4465 17.2688 10.7704 17.2688 11.1081V20.3306C17.2688 20.3306 17.7999 20.1155 18.3175 19.897C18.5097 19.8156 18.6737 19.6795 18.7891 19.5055C18.9045 19.3315 18.9661 19.1274 18.9663 18.9186V7.92396C18.9662 7.75672 18.9992 7.59111 19.0631 7.4366C19.1271 7.28208 19.2209 7.14168 19.3391 7.02342C19.4573 6.90516 19.5976 6.81135 19.7521 6.74734C19.9065 6.68334 20.0721 6.6504 20.2393 6.6504H22.3611C22.6988 6.6504 23.0226 6.78457 23.2614 7.02341C23.5001 7.26224 23.6343 7.58618 23.6343 7.92396V16.9775C25.4739 15.6438 27.3383 14.0397 28.8178 12.1109C29.0324 11.8309 29.1745 11.5021 29.2312 11.1539C29.288 10.8057 29.2577 10.4488 29.143 10.1151C28.142 7.19664 26.2642 4.65873 23.7665 2.84839C21.2689 1.03804 18.2732 0.0436298 15.1891 0.00111573C6.87262 -0.110642 -0.00050085 6.68053 0.000316102 15.001C-0.00784965 17.6338 0.679076 20.2222 1.99164 22.5043C2.17265 22.8164 2.43895 23.0704 2.75925 23.2364C3.07955 23.4024 3.44056 23.4735 3.79986 23.4413C4.20129 23.406 4.70106 23.356 5.29519 23.2863C5.55378 23.2568 5.79253 23.1333 5.96594 22.9391C6.13936 22.745 6.23534 22.4938 6.2356 22.2334V14.2833"
          fill="currentColor"
        />
        <path
          d="M6.1887 27.1304C8.4253 28.7581 11.0684 29.7351 13.8256 29.9533C16.5828 30.1715 19.3466 29.6225 21.8113 28.367C24.2759 27.1114 26.3453 25.1983 27.7905 22.8393C29.2357 20.4802 30.0004 17.7672 30 15.0004C30 14.655 29.984 14.3135 29.9609 13.9739C24.483 22.1463 14.3687 25.9669 6.1886 27.1307"
          fill="currentColor"
        />
      </g>
      <defs>
        <clipPath id="clip0_251_1386">
          <rect width="30" height="30" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

function OpenSeaIcon({
  className,
  size,
}: {
  size?: number | string;
  className?: string;
}): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      viewBox="0 0 30 30"
    >
      <title>OpenSea</title>
      <path
        d="M15 0C6.717 0 0 6.717 0 15C0 23.283 6.717 30 15 30C23.283 30 30 23.283 30 15C30 6.717 23.286 0 15 0ZM7.401 15.504L7.464 15.402L11.367 9.297C11.424 9.21 11.559 9.219 11.601 9.315C12.252 10.776 12.816 12.594 12.552 13.725C12.441 14.19 12.132 14.82 11.784 15.402C11.739 15.486 11.691 15.57 11.637 15.651C11.613 15.687 11.571 15.708 11.526 15.708H7.515C7.407 15.708 7.344 15.591 7.401 15.504ZM24.792 17.604C24.792 17.661 24.759 17.709 24.711 17.73C24.408 17.859 23.373 18.336 22.944 18.933C21.846 20.46 21.009 22.644 19.134 22.644H11.316C8.544 22.644 6.3 20.391 6.3 17.61V17.52C6.3 17.448 6.36 17.388 6.435 17.388H10.791C10.878 17.388 10.941 17.466 10.935 17.553C10.902 17.835 10.956 18.126 11.091 18.39C11.349 18.915 11.886 19.242 12.465 19.242H14.622V17.559H12.489C12.381 17.559 12.315 17.433 12.378 17.343C12.402 17.307 12.426 17.271 12.456 17.229C12.657 16.941 12.945 16.497 13.233 15.99C13.428 15.648 13.617 15.282 13.77 14.916C13.8 14.85 13.824 14.781 13.851 14.715C13.893 14.598 13.935 14.487 13.965 14.379C13.995 14.286 14.022 14.19 14.046 14.1C14.118 13.788 14.148 13.458 14.148 13.116C14.148 12.981 14.142 12.84 14.13 12.708C14.124 12.561 14.106 12.414 14.088 12.267C14.076 12.138 14.052 12.009 14.028 11.877C13.995 11.682 13.953 11.487 13.905 11.292L13.887 11.217C13.851 11.082 13.818 10.956 13.776 10.821C13.653 10.401 13.515 9.99 13.365 9.606C13.311 9.453 13.251 9.306 13.188 9.162C13.098 8.94 13.005 8.739 12.921 8.55C12.876 8.463 12.84 8.385 12.804 8.304C12.762 8.214 12.72 8.124 12.675 8.037C12.645 7.971 12.609 7.908 12.585 7.848L12.321 7.362C12.285 7.296 12.345 7.215 12.417 7.236L14.067 7.683H14.073C14.076 7.683 14.076 7.683 14.079 7.683L14.295 7.746L14.535 7.812L14.622 7.836V6.858C14.622 6.384 15 6 15.471 6C15.705 6 15.918 6.096 16.068 6.252C16.221 6.408 16.317 6.621 16.317 6.858V8.313L16.494 8.361C16.506 8.367 16.521 8.373 16.533 8.382C16.575 8.412 16.638 8.46 16.716 8.52C16.779 8.568 16.845 8.628 16.923 8.691C17.082 8.82 17.274 8.985 17.481 9.174C17.535 9.222 17.589 9.27 17.64 9.321C17.907 9.57 18.207 9.861 18.495 10.185C18.576 10.278 18.654 10.368 18.735 10.467C18.813 10.566 18.9 10.662 18.972 10.758C19.071 10.887 19.173 11.022 19.266 11.163C19.308 11.229 19.359 11.298 19.398 11.364C19.518 11.541 19.62 11.724 19.719 11.907C19.761 11.991 19.803 12.084 19.839 12.174C19.95 12.42 20.037 12.669 20.091 12.921C20.109 12.975 20.121 13.032 20.127 13.086V13.098C20.145 13.17 20.151 13.248 20.157 13.329C20.181 13.584 20.169 13.842 20.115 14.1C20.091 14.208 20.061 14.31 20.025 14.421C19.986 14.526 19.95 14.634 19.902 14.739C19.809 14.952 19.701 15.168 19.572 15.366C19.53 15.441 19.479 15.519 19.431 15.594C19.377 15.672 19.32 15.747 19.272 15.819C19.203 15.912 19.131 16.008 19.056 16.095C18.99 16.185 18.924 16.275 18.849 16.356C18.747 16.479 18.648 16.593 18.543 16.704C18.483 16.776 18.417 16.851 18.348 16.917C18.282 16.992 18.213 17.058 18.153 17.118C18.048 17.223 17.964 17.301 17.892 17.37L17.721 17.523C17.697 17.547 17.664 17.559 17.631 17.559H16.317V19.242H17.97C18.339 19.242 18.69 19.113 18.975 18.87C19.071 18.786 19.494 18.42 19.995 17.868C20.013 17.847 20.034 17.835 20.058 17.829L24.621 16.509C24.708 16.485 24.792 16.548 24.792 16.638V17.604Z"
        fill="currentColor"
      />
    </svg>
  );
}
