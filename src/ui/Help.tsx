import {
  CSSProperties,
  ForwardedRef,
  ReactNode,
  Reducer,
  createContext,
  forwardRef,
  useContext,
  useReducer,
  useRef,
} from "react";

import { assert } from "../assert";
import { ReservedSpace } from "./ReservedSpace";
import { ScreenReaderOnly } from "./a11y";
import { useAnimateOnOffScreen } from "./hooks/useAnimateOnOffScreen";
import { pxNumbersAsRem } from "./utils/units";

type SelectionMode = "preview" | "pin";

type HelpText = string | (() => JSX.Element);

interface HelpItemSelectedAction {
  type: "help-item-selected";
  mode: SelectionMode;
  helpId: string;
  helpText: HelpText;
}
interface HelpItemDeselectedAction {
  type: "help-item-deselected";
  mode: SelectionMode;
  helpId: string;
}
interface HelpEnabledAction {
  type: "help-enabled";
}
interface HelpDisabledAction {
  type: "help-disabled";
}

type HelpAction =
  | HelpItemSelectedAction
  | HelpItemDeselectedAction
  | HelpEnabledAction
  | HelpDisabledAction;

interface HelpItem {
  helpId: string;
  helpText: HelpText;
}

interface HelpState {
  dispatch: (action: HelpAction) => void;
  helpEnabled: boolean;
  pinnedHelpItem?: HelpItem;
  previewHelpItem?: HelpItem;
}

/** Return a HelpItem that's selected and matches the given helpId, or undefined. */
function getSelectedHelpItem(
  helpState: HelpState,
  { helpId, mode }: { helpId?: string; mode?: SelectionMode } = {},
): HelpItem | undefined {
  const selected =
    mode === "pin" ? helpState.pinnedHelpItem
    : mode === "preview" ? helpState.previewHelpItem
    : helpState.previewHelpItem ?? helpState.pinnedHelpItem;
  if (helpId && selected?.helpId !== helpId) return undefined;
  return selected;
}

export const HelpContext = createContext<HelpState>({
  dispatch() {
    throw new Error(
      "dispatch() called before HelpContext has been initialised",
    );
  },
  helpEnabled: false,
});

export function HelpProvider({
  children,
}: {
  children?: ReactNode;
}): JSX.Element {
  const help = useRootHelpState();
  return <HelpContext.Provider value={help}>{children}</HelpContext.Provider>;
}

function helpReducer(help: HelpState, action: HelpAction): HelpState {
  switch (action.type) {
    case "help-enabled": {
      return { ...help, helpEnabled: true };
    }
    case "help-disabled": {
      return { ...help, helpEnabled: false };
    }
    case "help-item-selected": {
      const helpItem: HelpItem = {
        helpId: action.helpId,
        helpText: action.helpText,
      };
      return {
        ...help,
        [action.mode === "pin" ? "pinnedHelpItem" : "previewHelpItem"]:
          helpItem,
      };
    }
    case "help-item-deselected": {
      return {
        ...help,
        [action.mode === "pin" ? "pinnedHelpItem" : "previewHelpItem"]:
          undefined,
      };
    }
    default: {
      assert(false, "unknown action: " + JSON.stringify(action));
    }
  }
}

export function useRootHelpState(): HelpState {
  const [help, dispatch] = useReducer<Reducer<HelpState, HelpAction>>(
    helpReducer,
    {
      dispatch: (action) => dispatch(action),
      helpEnabled: false,
    },
  );
  return help;
}

export type HelpMessageProps =
  | { helpId?: undefined; helpText: string }
  | { helpId: string; helpText: HelpText };

function ScreenReaderHelp({
  helpId: _helpId,
  helpText,
  children,
}: HelpMessageProps & { children?: ReactNode }): JSX.Element {
  const help = useContext(HelpContext);
  const helpId: string = _helpId === undefined ? helpText : _helpId;
  const isPinned = getSelectedHelpItem(help, { helpId, mode: "pin" });
  return (
    <div
      role="note"
      aria-label={isPinned ? "pinned extra help" : "extra help"}
      aria-hidden={help.helpEnabled ? undefined : "true"}
    >
      <ScreenReaderOnly>{renderHelpText(helpText)}</ScreenReaderOnly>
      {children}
    </div>
  );
}

type HelpButtonAppearanceProps = { idleBackgroundClasses?: string };

const HelpButton = forwardRef(function HelpButton(
  {
    helpId: _helpId,
    helpText,
    className,
    style,
    idleBackgroundClasses,
  }: HelpMessageProps &
    HelpButtonAppearanceProps & { className?: string; style?: CSSProperties },
  ref: ForwardedRef<HTMLButtonElement>,
): JSX.Element {
  const helpId = _helpId ?? helpText;
  const help = useContext(HelpContext);
  const isPinned =
    getSelectedHelpItem(help, { helpId, mode: "pin" }) !== undefined;
  const isSelected = getSelectedHelpItem(help, { helpId }) !== undefined;

  function selectForPreview() {
    help.dispatch({
      type: "help-item-selected",
      mode: "preview",
      helpId,
      helpText,
    });
  }
  function deselectForPreview() {
    help.dispatch({
      type: "help-item-deselected",
      mode: "preview",
      helpId,
    });
  }

  return (
    <button
      ref={ref}
      role="switch"
      aria-checked={helpId === help.pinnedHelpItem?.helpId}
      aria-hidden={help.helpEnabled ? undefined : "true"}
      aria-label="pin help to help area"
      style={style}
      className={`group focus-visible:outline-offset-1
                  ${help.helpEnabled ? "" : "hidden"}
                  ${isSelected ? "drop-shadow" : ""}
                  ${className || ""}`}
      onClick={(e) => {
        e.preventDefault();
        help.dispatch(
          isPinned ?
            { type: "help-item-deselected", mode: "pin", helpId }
          : { type: "help-item-selected", mode: "pin", helpId, helpText },
        );
      }}
      onMouseEnter={() => selectForPreview()}
      onMouseLeave={() => deselectForPreview()}
      onFocus={() => selectForPreview()}
      onBlur={() => deselectForPreview()}
    >
      <div
        className={`p-[0.125rem]  group-hover:scale-110 group-focus-visible:scale-110 group-active:scale-125
                    bg-green-700 transition-all duration-300
        ${isPinned ? "clip-circle" : "clip-circle-40"}
        ${isSelected ? "text-neutral-100" : idleBackgroundClasses ?? "bg-transparent"}`}
      >
        <HelpIcon />
      </div>
    </button>
  );
});

export function WithInlineHelp({
  disabled,
  children,
  className,
  iconOffsetLeft,
  iconOffsetTop,
  iconOffsetBottom,
  "sr-help-order": srHelpOrder = "before-content",
  ...props
}: HelpMessageProps &
  HelpButtonAppearanceProps & {
    disabled?: boolean;
    iconOffsetLeft?: string;
    iconOffsetTop?: string;
    iconOffsetBottom?: string;
    children: ReactNode;
    className?: string;
    "sr-help-order"?: "before-content" | "after-content";
  }): JSX.Element {
  if (iconOffsetTop && iconOffsetBottom) {
    throw new Error(
      "Both iconOffsetTop and iconOffsetBottom are set, which is ambiguous",
    );
  }

  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const helpButtonSize = "1.75rem";
  const fromTop = iconOffsetBottom === undefined;
  const style: CSSProperties = {
    left: `calc(${iconOffsetLeft ?? "-0.25rem"} + -${helpButtonSize})`,
    top:
      fromTop ?
        `calc(${iconOffsetTop ?? "45%"} - (${helpButtonSize} / 2))`
      : undefined,
    bottom:
      !fromTop ?
        `calc(${iconOffsetBottom} - (${helpButtonSize} / 2))`
      : undefined,
  };

  const renderedHelp =
    disabled ? undefined : (
      <ScreenReaderHelp {...props}>
        <HelpButton
          ref={button}
          {...props}
          style={style}
          className="absolute __-left-8 __top-[calc(45%_-_0.875rem)]"
        />
      </ScreenReaderHelp>
    );

  return (
    <div ref={container} className={`${className || ""} relative`}>
      {srHelpOrder === "before-content" && renderedHelp}
      {children}
      {srHelpOrder === "after-content" && renderedHelp}
    </div>
  );
}

export function HelpDialog(): JSX.Element {
  const help = useContext(HelpContext);
  const ref = useRef<HTMLDivElement>(null);
  const { height: modalHeight } = useAnimateOnOffScreen({
    elRef: ref,
    edge: "bottom",
    initialVisibility: help.helpEnabled ? "open" : "closed",
    visibility: help.helpEnabled ? "open" : "closed",
    closedOffset: "2rem",
  });

  return (
    <>
      {/* Provide empty space under the modal footer so that the page content
          can scroll all the way into view, above the modal footer. */}
      <ReservedSpace required={help.helpEnabled} height={modalHeight ?? 0} />
      <aside aria-label="help">
        <HelpToggleSwitch
          help={help}
          onClick={() => {
            help.dispatch({
              type: help.helpEnabled ? "help-disabled" : "help-enabled",
            });
          }}
        />
        <div
          ref={ref}
          className="fixed z-10 -inset-x-8 transition-[top] duration-500"
        >
          <div
            className={[
              "pl-12 pr-12 pt-2 pb-4 min-h-[6rem] origin-top-left translate-y-4 -rotate-[0.25deg]",
              "bg-gradient-to-b via-25% from-neutral-25 to-neutral-100",
              "dark:from-neutral-800 dark:via-neutral-875 dark:to-neutral-875",
              "shadow-[0_-13px_50px_-12px_rgb(0_0_0_/_0.25)] dark:shadow-[0_-13px_50px_-12px_black]",
            ].join(" ")}
          >
            <div className="border-t border-neutral-200 dark:border-neutral-750">
              <div
                className={[
                  "flex flex-row justify-center",
                  "p-4 pl-24 pr-8 lg:px-24",
                ].join(" ")}
              >
                <HelpDisplay help={help} />
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

type HelpToggleSwitchProps = { help: HelpState } & Pick<
  JSX.IntrinsicElements["button"],
  "onClick"
>;

function HelpToggleSwitch({
  help,
  onClick,
}: HelpToggleSwitchProps): JSX.Element {
  const selectedHelpItem = getSelectedHelpItem(help);
  const hasPinnedHelpItem =
    getSelectedHelpItem(help, { mode: "pin" }) !== undefined;

  return (
    <button
      role="switch"
      aria-checked={help.helpEnabled}
      aria-label="enable extra help"
      className={`fixed z-30 left-2 bottom-2 group focus-visible:outline-offset-0
  ${help.helpEnabled && selectedHelpItem ? "drop-shadow" : ""}`}
      onClick={onClick}
    >
      <div
        className={`p-2 transition-all duration-300
                group-hover:scale-110 group-focus-visible:scale-110 group-active:scale-125
    ${
      help.helpEnabled && selectedHelpItem ?
        "bg-green-700 text-neutral-100"
      : "bg-neutral-50/75 dark:bg-neutral-900/75"
    }
    ${
      (
        hasPinnedHelpItem &&
        selectedHelpItem?.helpId === help.pinnedHelpItem?.helpId
      ) ?
        "clip-circle-44"
      : "clip-circle-37"
    }
    `}
      >
        <HelpIconLarge />
      </div>
    </button>
  );
}

function HelpDisplay({ help }: { help: HelpState }): JSX.Element {
  const selectedHelpItem = getSelectedHelpItem(help);

  return (
    <div className="max-w-prose flex flex-col justify-center">
      {help.helpEnabled ?
        <p className="sr-only">
          Extra help is currently enabled. Screen readers can find the help
          alongside the items in the page. If an item&apos;s help is pinned it
          will appear here.
        </p>
      : <p className="sr-only">Extra help is currently disabled.</p>}

      <div
        // Using role="status" could make sense here. We're not doing that
        // because it causes the SR to read the contents of this element
        // when it changes, and that's repetitive because we include help
        // inline as a note.
        role="note"
        aria-hidden={help.helpEnabled ? undefined : "true"}
        aria-label={
          selectedHelpItem ? "pinned help" : "pinned help with nothing pinned"
        }
        aria-disabled={selectedHelpItem ? undefined : "true"}
      >
        {selectedHelpItem ?
          renderHelpText(selectedHelpItem.helpText)
        : <i className="italic">
            Press a <span className="sr-only">pin help button</span>
            <HelpIcon className="inline" /> to show more information here.
          </i>
        }
      </div>
    </div>
  );
}

function renderHelpText(helpText: HelpText): JSX.Element {
  return typeof helpText === "string" ? <>{helpText}</> : helpText();
}

function HelpIcon({
  className,
  size,
}: {
  size?: number | string;
  className?: string;
}): JSX.Element {
  size = size ?? 24;
  return (
    // https://fonts.google.com/icons?selected=Material+Symbols+Outlined:help:FILL@0;wght@400;GRAD@0;opsz@24&icon.query=help
    <svg
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      width={pxNumbersAsRem(size)}
    >
      <title>Help</title>
      <path
        fill="currentColor"
        d="M479-247q19.74 0 33.37-13.63Q526-274.26 526-294q0-19.74-13.63-33.37Q498.74-341 479-341q-19.74 0-33.37 13.63Q432-313.74 432-294q0 19.74 13.63 33.37Q459.26-247 479-247Zm-35-149h70q0-31.5 7.75-50T563-497q26-25 40-48.25T617-600q0-54.552-39.25-83.776Q538.5-713 484.174-713q-55.296 0-89.735 28.75T346-615l63.211 24q4.789-18 22.043-38 17.253-20 52.746-20 32 0 48 17.5t16 38.5q0 20-11.75 37T507-524q-42.5 37.5-52.75 57.75T444-396Zm36 306q-80.907 0-152.065-30.763-71.159-30.763-123.797-83.5Q151.5-257 120.75-328.087 90-399.175 90-480q0-80.907 30.763-152.065 30.763-71.159 83.5-123.797Q257-808.5 328.087-839.25 399.175-870 480-870q80.907 0 152.065 30.763 71.159 30.763 123.797 83.5Q808.5-703 839.25-631.913 870-560.825 870-480q0 80.907-30.763 152.065-30.763 71.159-83.5 123.797Q703-151.5 631.913-120.75 560.825-90 480-90Zm0-75q131.5 0 223.25-91.75T795-480q0-131.5-91.75-223.25T480-795q-131.5 0-223.25 91.75T165-480q0 131.5 91.75 223.25T480-165Zm0-315Z"
      />
    </svg>
  );
}

function HelpIconLarge({
  className,
  size,
}: {
  size?: number | string;
  className?: string;
}): JSX.Element {
  size = size ?? 48;
  return (
    // https://fonts.google.com/icons?selected=Material+Symbols+Outlined:help:FILL@0;wght@400;GRAD@0;opsz@48&icon.query=help
    <svg
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      width={pxNumbersAsRem(size)}
    >
      <title>Help</title>
      <path
        fill="currentColor"
        d="M484-247q16 0 27-11t11-27q0-16-11-27t-27-11q-16 0-27 11t-11 27q0 16 11 27t27 11Zm-35-146h59q0-26 6.5-47.5T555-490q31-26 44-51t13-55q0-53-34.5-85T486-713q-49 0-86.5 24.5T345-621l53 20q11-28 33-43.5t52-15.5q34 0 55 18.5t21 47.5q0 22-13 41.5T508-512q-30 26-44.5 51.5T449-393Zm31 313q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 31.5-156t86-127Q252-817 325-848.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 82-31.5 155T763-197.5q-54 54.5-127 86T480-80Zm0-60q142 0 241-99.5T820-480q0-142-99-241t-241-99q-141 0-240.5 99T140-480q0 141 99.5 240.5T480-140Zm0-340Z"
      />
    </svg>
  );
}
