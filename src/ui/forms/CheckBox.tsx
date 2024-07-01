import { useId, useState } from "react";

import { CheckboxSelected, CheckboxUnselected } from "../icons";

export type CheckBoxProps = {
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-labeledBy"?: string;
  "aria-description"?: string;
  "aria-describedBy"?: string;
  selected?: boolean;
  required?: boolean;
  onChange?: (isSelected: boolean) => void;
};

export function CheckBox({ selected, onChange, ...inputProps }: CheckBoxProps) {
  const [isSelected, setIsSelected] = useState(selected ?? false);
  const Icon = isSelected ? CheckboxSelected : CheckboxUnselected;

  const toggle = () => {
    setIsSelected(!isSelected);
    onChange && onChange(!isSelected);
  };

  return (
    <div
      className="mx-2 grid grid-rows-1 grid-cols-1 w-6 h-6 shrink-0 items-center justify-items-center"
      onClick={toggle}
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
        onChange={toggle}
        checked={isSelected}
        {...inputProps}
      />
    </div>
  );
}

export function InlineCheckBox({
  name,
  label,
  ...props
}: CheckBoxProps & {
  name: string;
  label: string;
}) {
  const checkboxId = props.id || useId();
  return (
    <div className="flex flex-row">
      <CheckBox {...props} name={name} id={checkboxId} />
      <div>
        <label htmlFor={checkboxId}>{label}</label>
      </div>
    </div>
  );
}
