import { useEffect, useRef, useState } from "react";
import { UseAccountReturnType, useConnect, useDisconnect } from "wagmi";

import { assert } from "../assert";
import { log } from "../logging";
import { WalletConnectorType } from "../wagmi";
import { Button, LinkButton } from "./Button";
import { EthAccount, FadeOut } from "./EthAccount";
import { WithInlineHelp } from "./Help";
import { IndeterminateProgressBar } from "./IndeterminateProgressBar";
import { useLazyConnectors } from "./hooks/wallet";
import { useVaultonomyStoreSingle } from "./state/useVaultonomyStore";
import { pxNumbersAsRem } from "./utils/units";

export function Wallet({
  wallet,
}: {
  wallet: UseAccountReturnType;
}): JSX.Element {
  const { disconnect } = useDisconnect();
  const [selectedType, setSelectedType] = useState<WalletConnectorType>();

  const stats = useVaultonomyStoreSingle((s) => s.stats);
  useEffect(() => {
    if (selectedType && wallet.isConnected) {
      stats?.logEvent({
        name: "VT_wallet_connected",
        params: {
          wallet_provider: selectedType,
        },
      });
    }
  }, [stats, selectedType, wallet.isConnected]);

  if (wallet.isConnected) {
    return (
      <>
        <EthAccount
          type="connected-wallet"
          title="Wallet"
          ethAddress={wallet.address}
          footer={
            <LinkButton onClick={() => disconnect()} className="italic text-sm">
              Disconnect wallet
            </LinkButton>
          }
        />
      </>
    );
  } else {
    return (
      <>
        <EthAccount
          type="connected-wallet"
          title="Wallet"
          subtitle="Not connected"
        >
          <ConnectWallet
            selectedType={selectedType}
            setSelectedType={setSelectedType}
          />
        </EthAccount>
      </>
    );
  }
}

function ConnectWallet({
  className,
  selectedType,
  setSelectedType,
}: {
  className?: string;
  selectedType: WalletConnectorType | undefined;
  setSelectedType: (type: WalletConnectorType) => void;
}): JSX.Element {
  const connectors = useLazyConnectors();

  const { status, connect, error } = useConnect();
  const isErrorUserCancel = error?.name === "UserRejectedRequestError";

  useCoinbaseWalletModalCloseOnBgClick(
    status === "pending" && selectedType === WalletConnectorType.Coinbase,
  );

  const getButtonOptions = (
    type: WalletConnectorType,
  ): {
    walletType: WalletConnectorType;
    state: ConnectButtonState;
    connect?: () => void;
  } => {
    const connectorType = connectors[type];
    if (!connectorType.isAvailable) {
      return { walletType: type, state: "unavailable" };
    }
    const connectType = () => {
      setSelectedType(type);
      connect({ connector: connectorType.getConnector() });
    };
    if (selectedType === type) {
      const selectedState: ConnectButtonState =
        status === "pending" ? "connecting"
        : status === "success" ? "connected"
        : "idle";
      return { walletType: type, state: selectedState, connect: connectType };
    }
    return {
      walletType: type,
      state: status === "success" ? "inactive" : "idle",
      connect: connectType,
    };
  };

  return (
    <FadeOut>
      <section aria-label="Connect to Wallet" className={className}>
        <WithInlineHelp
          iconOffsetTop="0rem"
          iconOffsetLeft="-0.5rem"
          helpText="Connect your crypto Wallet to Vaultonomy. You can pair your Wallet with your Reddit account after connecting."
        >
          <div className="flex flex-col gap-2 bg-default">
            <ConnectButton
              {...getButtonOptions(WalletConnectorType.MetaMask)}
            />
            <ConnectButton
              {...getButtonOptions(WalletConnectorType.Coinbase)}
            />
            <WithInlineHelp helpText="Wallets other than MetaMask and Coinbase can connect using WalletConnect.">
              <ConnectButton
                {...getButtonOptions(WalletConnectorType.WalletConnect)}
              />
            </WithInlineHelp>

            {/* TODO: check actual errors have reasonable message values */}
            {status === "error" && error && !isErrorUserCancel ?
              <div className="text-red-500">
                The Wallet failed to connect.
                {error.message && ` (${error.message})`}
              </div>
            : undefined}
          </div>
        </WithInlineHelp>
      </section>
    </FadeOut>
  );
}

type ConnectButtonState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnecting"
  | "inactive"
  | "unavailable";

function ConnectButton({
  walletType,
  state,
  connect,
}: {
  walletType: WalletConnectorType;
  state: ConnectButtonState;
  connect?: () => void;
}): JSX.Element {
  const isUsable = state !== "unavailable";

  const { LogoEl, promptAbove, promptBelow, walletName, unusableText } =
    connectButtonAttrs[walletType];

  const textAbove =
    state === "connecting" ? "Connecting…"
    : state === "disconnecting" ? "Disconnecting…"
      // not visible in practice
    : state === "connected" ? "Connected"
    : isUsable ? promptAbove
    : undefined;
  const textBelow = isUsable ? promptBelow : unusableText;

  return (
    <Button
      disabled={!isUsable}
      onClick={connect}
      className={`relative w-full sm:w-full ${
        isUsable ? "" : "opacity-50 grayscale-[60%]"
      }`}
      paddingClassName=""
    >
      <div className="px-6 py-5 grid grid-cols-[4rem_1fr] gap-x-4 grid-rows-[auto_auto_auto] text-left">
        <LogoEl className="row-start-1 col-start-1 row-span-3 justify-self-center self-center" />
        {textAbove ?
          <div className="text-sm col-start-2 row-start-1 self-end -mb-[0.35rem] -ml-1">
            {textAbove}
          </div>
        : undefined}
        <div className="text-2xl col-start-2 row-start-2">{walletName}</div>
        {textBelow ?
          <div className="text-sm col-start-2 row-start-3 self-end -mt-2 ml-1">
            {textBelow}
          </div>
        : undefined}
      </div>
      {state === "connecting" ?
        <div className="absolute bottom-0 left-0 w-full">
          <IndeterminateProgressBar />
        </div>
      : undefined}
    </Button>
  );
}

export function WalletConnectLogo({
  className,
  width,
}: {
  width?: number | string;
  className?: string;
}): JSX.Element {
  width = width ?? 60;
  return (
    <svg
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width={pxNumbersAsRem(width)}
      viewBox="0 0 60 36"
      fill="none"
    >
      <title>WalletConnect</title>
      <path
        d="M12.2866 7.03418C22.0725 -2.34473 37.9342 -2.34473 47.7202 7.03418L48.8961 8.16601C49.3827 8.63595 49.3827 9.39712 48.8961 9.86706L44.8682 13.7259C44.6249 13.9575 44.2262 13.9575 43.9829 13.7259L42.3609 12.1704C35.535 5.63101 24.465 5.63101 17.6391 12.1704L15.9022 13.8318C15.6589 14.0634 15.2602 14.0634 15.0169 13.8318L10.989 9.97296C10.5024 9.50302 10.5024 8.74185 10.989 8.27191L12.2798 7.03418H12.2866ZM56.0532 15.0165L59.6351 18.4517C60.1217 18.9217 60.1217 19.6828 59.6351 20.1528L43.4693 35.6475C42.9827 36.1175 42.1852 36.1175 41.6986 35.6475L30.223 24.6536C30.1014 24.5345 29.9054 24.5345 29.777 24.6536L18.3014 35.6475C17.8148 36.1175 17.0173 36.1175 16.5308 35.6475L0.364947 20.1528C-0.121649 19.6828 -0.121649 18.9217 0.364947 18.4517L3.94684 15.0165C4.43343 14.5466 5.23091 14.5466 5.7175 15.0165L17.1931 26.0105C17.3147 26.1296 17.5107 26.1296 17.6391 26.0105L29.1147 15.0165C29.6013 14.5466 30.3987 14.5466 30.8853 15.0165L42.3609 26.0171C42.4825 26.1362 42.6785 26.1362 42.8069 26.0171L54.2825 15.0232C54.7691 14.5532 55.5666 14.5532 56.0532 15.0232V15.0165Z"
        fill="#5570FF"
      />
    </svg>
  );
}

export function CoinbaseLogo({
  className,
  width,
}: {
  width?: number | string;
  className?: string;
}): JSX.Element {
  width = width ?? 52;
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={pxNumbersAsRem(width)}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Coinbase</title>
      <circle cx="14" cy="14" r="14" fill="#0052FF" />
      <path
        d="M23.852 14A9.834 9.834 0 0 1 14 23.852 9.834 9.834 0 0 1 4.148 14 9.834 9.834 0 0 1 14 4.148 9.834 9.834 0 0 1 23.852 14Z"
        fill="#fff"
      />
      <path
        d="M11.185 12.504c0-.456 0-.71.098-.862.098-.152.196-.304.343-.355.196-.102.392-.102.881-.102h2.986c.49 0 .686 0 .882.102.146.101.293.203.342.355.098.203.098.406.098.862v2.992c0 .457 0 .71-.098.863-.098.152-.195.304-.342.355-.196.101-.392.101-.882.101h-2.986c-.49 0-.685 0-.88-.101-.148-.102-.295-.203-.344-.355-.098-.203-.098-.406-.098-.863v-2.992Z"
        fill="#0052FF"
      />
    </svg>
  );
}

export function MetaMaskLogo({
  className,
  width,
}: {
  width?: number | string;
  className?: string;
}): JSX.Element {
  width = width ?? 52;
  return (
    <svg
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      width={pxNumbersAsRem(width)}
      viewBox="0 0 35.6 33"
    >
      <title>MetaMask</title>
      <path
        fill="#E17726"
        stroke="#E17726"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth=".25"
        d="m32.96 1-13.14 9.72 2.45-5.73L32.96 1Z"
      ></path>
      <path
        fill="#E27625"
        stroke="#E27625"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth=".25"
        d="m2.66 1 13.02 9.8L13.35 5 2.66 1Zm25.57 22.53-3.5 5.34 7.49 2.06 2.14-7.28-6.13-.12Zm-26.96.12 2.13 7.28 7.47-2.06-3.48-5.34-6.12.12Z"
      ></path>
      <path
        fill="#E27625"
        stroke="#E27625"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth=".25"
        d="m10.47 14.51-2.08 3.14 7.4.34-.24-7.97-5.08 4.5Zm14.68.01-5.16-4.6-.17 8.07 7.4-.34-2.07-3.13ZM10.87 28.87l4.49-2.16-3.86-3-.63 5.16Zm9.4-2.17 4.46 2.17-.6-5.17-3.86 3Z"
      ></path>
      <path
        fill="#D5BFB2"
        stroke="#D5BFB2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth=".25"
        d="m24.73 28.87-4.46-2.16.36 2.9-.04 1.23 4.14-1.97Zm-13.86 0 4.16 1.97-.03-1.23.36-2.9-4.49 2.16Z"
      ></path>
      <path
        fill="#233447"
        stroke="#233447"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth=".25"
        d="m15.1 21.78-3.7-1.08 2.62-1.2 1.09 2.28Zm5.41 0 1.1-2.29 2.63 1.2-3.73 1.1Z"
      ></path>
      <path
        fill="#CC6228"
        stroke="#CC6228"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth=".25"
        d="m10.87 28.87.65-5.34-4.13.12 3.48 5.22Zm13.23-5.34.63 5.34 3.5-5.22-4.13-.12Zm3.13-5.88-7.4.34.68 3.8 1.1-2.3 2.63 1.2 2.99-3.04ZM11.4 20.7l2.62-1.2 1.09 2.28.69-3.8-7.4-.33 3 3.05Z"
      ></path>
      <path
        fill="#E27525"
        stroke="#E27525"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth=".25"
        d="m8.4 17.65 3.1 6.05-.1-3-3-3.05Zm15.84 3.05-.12 3 3.1-6.05-2.98 3.05Zm-8.44-2.71-.7 3.8.88 4.48.2-5.91-.38-2.37Zm4.02 0-.36 2.36.18 5.92.87-4.49-.69-3.8Z"
      ></path>
      <path
        fill="#F5841F"
        stroke="#F5841F"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth=".25"
        d="m20.51 21.78-.87 4.49.63.44 3.85-3 .12-3.01-3.73 1.08ZM11.4 20.7l.1 3 3.86 3 .62-.43-.87-4.49-3.72-1.08Z"
      ></path>
      <path
        fill="#C0AC9D"
        stroke="#C0AC9D"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth=".25"
        d="m20.6 30.84.03-1.23-.34-.28h-4.96l-.33.28.03 1.23-4.16-1.97 1.46 1.2 2.95 2.03h5.05l2.96-2.04 1.44-1.19-4.14 1.97Z"
      ></path>
      <path
        fill="#161616"
        stroke="#161616"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth=".25"
        d="m20.27 26.7-.63-.43h-3.66l-.62.44-.36 2.9.33-.28h4.96l.34.28-.36-2.9Z"
      ></path>
      <path
        fill="#763E1A"
        stroke="#763E1A"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth=".25"
        d="M33.52 11.35 34.62 6l-1.66-5-12.7 9.4 4.89 4.11 6.9 2.01 1.52-1.77-.66-.48 1.05-.96-.8-.62 1.05-.8-.7-.54ZM1 5.99l1.12 5.36-.72.53 1.07.8-.8.63 1.04.96-.66.48 1.52 1.77 6.9-2 4.89-4.13L2.66 1 1 5.99Z"
      ></path>
      <path
        fill="#F5841F"
        stroke="#F5841F"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth=".25"
        d="m32.05 16.52-6.9-2 2.08 3.13-3.1 6.05 4.1-.05h6.13l-2.31-7.13Zm-21.58-2.01-6.9 2.01-2.3 7.13H7.4l4.1.05-3.1-6.05 2.08-3.14Zm9.35 3.48.45-7.6 2-5.4h-8.92l2 5.4.45 7.6.17 2.38v5.9h3.67l.02-5.9.16-2.38Z"
      ></path>
    </svg>
  );
}

type LogoElFn =
  | typeof MetaMaskLogo
  | typeof CoinbaseLogo
  | typeof WalletConnectLogo;
const connectButtonAttrs: Record<
  WalletConnectorType,
  {
    LogoEl: LogoElFn;
    promptAbove: string;
    walletName: string;
    promptBelow?: string;
    unusableText?: string;
  }
> = {
  [WalletConnectorType.MetaMask]: {
    LogoEl: MetaMaskLogo,
    promptAbove: "Connect",
    walletName: "MetaMask",
    unusableText: "Not installed",
  },
  [WalletConnectorType.Coinbase]: {
    LogoEl: CoinbaseLogo,
    promptAbove: "Connect",
    walletName: "Coinbase Wallet",
  },
  [WalletConnectorType.WalletConnect]: {
    LogoEl: WalletConnectLogo,
    promptAbove: "Connect",
    walletName: "Other Wallets",
    promptBelow: "with WalletConnect",
    unusableText: undefined,
  },
};

/**
 * The Coinbase Wallet modal has some a11y & UX issues in that it's not
 * responsive, doesn't close when you press esc or click outside the modal,
 * doesn't capture focus, doesn't have aria attrs. 🙁
 *
 * Its close (x) button doesn't work until it's loaded, so if you open it on a
 * slow network you get stuck with it trying to load. To mitigiate some of this,
 * this adds extra event handlers to close the modal when esc is pressed or the
 * page outside the modal is clicked.
 *
 * @param enabled Should be true while the CB modal is expected to be visible.
 */
function useCoinbaseWalletModalCloseOnBgClick(enabled: boolean): void {
  const modalEl = useRef<HTMLElement>();

  useEffect(() => {
    if (!enabled) return;
    assert(!modalEl.current);
    const onStop: Array<() => void> = [];

    const removeClosedModalEls = () => {
      // CB SDK does not remove the HTML it adds to the page to show the modal
      // when it closes. So these zombie modals accumulate and screw up event
      // listener registration below. Luckilly they add their HTML directly
      // under the root html element, so it's easy to identify! 🙃
      const els = [...document.querySelectorAll("html > *:not(head,body)")];
      // Delay removal to allow the close animation to run
      setTimeout(() => {
        els.forEach((el) => el.remove());
      }, 200);
    };
    onStop.push(removeClosedModalEls);

    const clickCloseButton = () => {
      log.debug("db-dialog: clickCloseButton", modalEl.current);
      modalEl.current
        ?.querySelector<HTMLButtonElement>("button.-cbwsdk-cancel-button")
        ?.click();
    };

    const onModalBgClick = function (this: HTMLElement, ev: MouseEvent): void {
      // click was on a descendant of the modal el, so not the background
      if (this !== ev.target) return;
      clickCloseButton();
    };

    const onEscKeyDown = function (ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        clickCloseButton();
      }
    };

    const setup = () => {
      // Select the last modal as CB SDK doesn't remove previously-closed
      // modals (see removeClosedModalEls).
      const el = [
        ...document.querySelectorAll<HTMLElement>(".-cbwsdk-connect-dialog"),
      ].at(-1);
      if (!el) return;
      clearInterval(setupId);
      assert(!modalEl.current);
      modalEl.current = el;

      el.addEventListener("click", onModalBgClick);
      onStop.push(() => el.removeEventListener("click", onModalBgClick));

      document.addEventListener("keydown", onEscKeyDown);
      onStop.push(() => document.removeEventListener("keydown", onEscKeyDown));
    };

    const setupId = setInterval(setup, 100);
    onStop.push(() => clearInterval(setupId));

    return () => {
      modalEl.current = undefined;
      for (const stop of onStop) stop();
    };
  }, [enabled]);
}
