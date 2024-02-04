import { ReactNode, useId, useState } from "react";

import { log } from "../../logging";
import { CheckboxSelected, CheckboxUnselected } from "../icons";

const prefixes = [
  [],
  ["checked"],
  ["hover"],
  ["checked", "hover"],
  ["checked", "focus"],
];
const checkboxResetClasses = ["_bg-none", "bg-transparent", "border-none"];
const checkboxReset = prefixes
  .flatMap((pf) => {
    const prefix = `${pf.join(":")}${pf ? ":" : ""}`;
    return checkboxResetClasses.map((cls) => `${prefix}${cls}`);
  })
  .join(" ");

export function CheckBox({
  selected,
  onChange,
  ...inputProps
}: {
  name?: string;
  "aria-label"?: string;
  "aria-labeledBy"?: string;
  "aria-description"?: string;
  "aria-describedBy"?: string;
  selected?: boolean;
  onChange?: (isSelected: boolean) => void;
}) {
  const [isSelected, setIsSelected] = useState(selected ?? false);
  const Icon = isSelected ? CheckboxSelected : CheckboxUnselected;

  return (
    <div
      className="mx-2 grid grid-rows-1 grid-cols-1 w-6 h-6 shrink-0 items-center justify-items-center"
      onClick={() => {
        setIsSelected(!isSelected);
        onChange && onChange(!isSelected);
      }}
    >
      <svg
        aria-hidden="true"
        className={[
          "row-start-1 col-start-1 w-full h-full",
          "transition-transform hover:scale-110",
        ].join(" ")}
      >
        {/* Need the outer svg to maintain the hover state when isSelected changes the inner icon */}
        <Icon size={24} />
      </svg>
      <input
        className={[
          "row-start-1 col-start-1 w-4 h-4",
          // tw-forms overrides our global focus styles
          "outline-none focus-visible:outline-dashed focus-visible:outline-offset-4 focus-visible:outline-logo-background rounded-sm",
          // Make the tw-forms default styles invisible. We use the SVG icons for visuals.
          "bg-transparent border-none",
          "checked:bg-none checked:bg-transparent",
          "hover:bg-transparent",
          "focus:ring-none",
          "checked:hover:bg-transparent",
          "checked:focus:bg-transparent ",
        ].join(" ")}
        type="checkbox"
        onChange={() => setIsSelected(!isSelected)}
        checked={isSelected}
        {...inputProps}
      />
    </div>
  );
}

export function InlineCheckBox({
  name,
  label,
  description,
}: {
  name: string;
  label: string;
  description?: ReactNode;
}) {
  const labelId = description ? useId() : undefined;
  const descId = description ? useId() : undefined;
  return (
    <div className="flex flex-row">
      <CheckBox
        name={name}
        // Apple's VoiceOver has poor support for labeling checkboxes. The
        // only things that work right are:
        // <label><input type="checkbox">my label</label> or using aria-label
        // on the input. For simplicity, we use aria-label and hide the visual
        // label for screen readers.
        aria-label={label}
        aria-describedBy={descId}
      />
      <div>
        <label aria-hidden="true" id={labelId} htmlFor={name}>
          {label}
        </label>
        {description && (
          <p id={descId} role="note">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
