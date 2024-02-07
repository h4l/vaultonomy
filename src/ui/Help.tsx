import {
  CSSProperties,
  ForwardedRef,
  ReactNode,
  Reducer,
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";

import { assert } from "../assert";
import { ScreenReaderOnly } from "./a11y";

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
      onClick={() => {
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

function useWindowWidth(): number {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const listener = () => {
      setWidth(window.innerWidth);
    };
    addEventListener("resize", listener);
    return () => removeEventListener("resize", listener);
  }, []);
  return width;
}

export function HelpModal(): JSX.Element {
  const help = useContext(HelpContext);
  const hasPinnedHelpItem =
    getSelectedHelpItem(help, { mode: "pin" }) !== undefined;
  const selectedHelpItem = getSelectedHelpItem(help);
  const reservedSpace = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLElement>(null);
  const [reservedSpaceOnScreen, setReservedSpaceOnScreen] = useState(false);
  const [modalHeight, setModalHeight] = useState(0);
  // const [state, setState] = useState(initialState);
  const [transitionState, setTransitionState] = useState<
    "at-end" | "at-start" | "started"
  >("at-end");
  const windowWidth = useWindowWidth();

  // Track whether the space under fixed footer (to allow scrolling to the bottom)
  // is on screen, so that we don't cause a jump by removing it when visible.
  useEffect(() => {
    if (!reservedSpace.current) {
      setReservedSpaceOnScreen(false);
      return;
    }

    const el = reservedSpace.current;
    const observer = new IntersectionObserver((entries) => {
      assert(entries.length === 1);
      assert(entries[0].target === el);
      setReservedSpaceOnScreen(entries[0].isIntersecting);
    });
    observer.observe(el);
    return () => observer.unobserve(el);
  }, [reservedSpace]);

  useEffect(
    () => {
      setModalHeight(ref.current?.offsetHeight ?? 0);
    },
    // Include width & text as a dependency to recalculate on resize.
    [ref, windowWidth, selectedHelpItem],
  );

  // Apply styles for the slide in/out CSS transitions. For the transitions to
  // animate correctly, these need to be applied as side-effects to ensure the
  // starting values are set before the ending values are.
  useEffect(() => {
    assert(ref.current);

    // Position from the top when closed and bottom when open so that changes to
    // screen width that affect element height cause it to remain entirely
    // off/on screen when closed/open.
    if (transitionState === "at-start") {
      if (!help.helpEnabled) {
        ref.current.style.top = `calc(100% - ${ref.current.offsetHeight}px)`;
        ref.current.style.bottom = "";
      } else {
        ref.current.style.top = "";
        ref.current.style.bottom = `-${ref.current.offsetHeight}px`;
      }
      setTransitionState("started");
    } else {
      if (!help.helpEnabled) {
        ref.current.style.top = "100%";
        ref.current.style.bottom = "";
      } else {
        ref.current.style.top = "";
        ref.current.style.bottom = "0px";
      }
    }
  }, [help.helpEnabled, transitionState, modalHeight]);

  return (
    // This outer div provides empty space under the modal footer so that the
    // content can scroll all the way into view, above the modal footer.
    // By transitioning height, the scroll bars don't jump when we add/remove
    // the space.
    <div
      ref={reservedSpace}
      className="h-0 transition-[height] duration-1000"
      style={{
        height:
          help.helpEnabled || reservedSpaceOnScreen ?
            `${modalHeight}px`
          : undefined,
      }}
    >
      <aside
        ref={ref}
        aria-label="help"
        className="fixed z-10 w-full left-0 min-h-[5rem]
                   flex flex-row justify-center
                   p-4 pl-24 pr-8 lg:px-24
                  border-t-2 border-dashed border-neutral-400 dark:border-neutral-500 bg-white dark:bg-neutral-925
                  transition-[top,bottom]"
        onTransitionEnd={() => setTransitionState("at-end")}
      >
        <button
          role="switch"
          aria-checked={help.helpEnabled}
          aria-label="enable extra help"
          className={`fixed left-2 bottom-2 group focus-visible:outline-offset-0
          ${help.helpEnabled && selectedHelpItem ? "drop-shadow" : ""}`}
          onClick={() => {
            help.dispatch({
              type: help.helpEnabled ? "help-disabled" : "help-enabled",
            });
            setTransitionState("at-start");
          }}
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
        <div className="max-w-prose flex flex-col justify-center">
          {help.helpEnabled ?
            <p className="sr-only">
              Extra help is currently enabled. Screen readers can find the help
              alongside the items in the page. If an item&apos;s help is pinned
              it will appear here.
            </p>
          : <p className="sr-only">Extra help is currently disabled.</p>}

          <p
            // Using role="status" could make sense here. We're not doing that
            // because it causes the SR to read the contents of this element
            // when it changes, and that's repetitive because we include help
            // inline as a note.
            role="note"
            aria-hidden={help.helpEnabled ? undefined : "true"}
            aria-label={
              selectedHelpItem ? "pinned help" : (
                "pinned help with nothing pinned"
              )
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
          </p>
        </div>
      </aside>
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
      width={size}
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
      width={size}
    >
      <title>Help</title>
      <path
        fill="currentColor"
        d="M484-247q16 0 27-11t11-27q0-16-11-27t-27-11q-16 0-27 11t-11 27q0 16 11 27t27 11Zm-35-146h59q0-26 6.5-47.5T555-490q31-26 44-51t13-55q0-53-34.5-85T486-713q-49 0-86.5 24.5T345-621l53 20q11-28 33-43.5t52-15.5q34 0 55 18.5t21 47.5q0 22-13 41.5T508-512q-30 26-44.5 51.5T449-393Zm31 313q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 31.5-156t86-127Q252-817 325-848.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 82-31.5 155T763-197.5q-54 54.5-127 86T480-80Zm0-60q142 0 241-99.5T820-480q0-142-99-241t-241-99q-141 0-240.5 99T140-480q0 141 99.5 240.5T480-140Zm0-340Z"
      />
    </svg>
  );
}
