import { twMerge } from "tailwind-merge";

type ButtonSize = "xl" | "l";

const sizeTwClasses: Record<ButtonSize, Record<"text" | "padding", string>> = {
  xl: { text: "text-4xl", padding: "px-7 py-5 pt-[1.375rem]" },
  l: { text: "text-2xl", padding: "px-4 py-3" },
};

export function Button({
  size: _size,
  children,
  className,
  paddingClassName,
  ...props
}: {
  size?: ButtonSize;
  className?: string;
  paddingClassName?: string;
  children: React.ReactNode;
} & JSX.IntrinsicElements["button"]): JSX.Element {
  const size = _size ?? "xl";
  const { text, padding } = sizeTwClasses[size];
  return (
    <button
      {...props}
      className={`border rounded-md border-neutral-200 border-l-neutral-300 border-b-neutral-300
        dark:border-neutral-800 dark:border-l-neutral-750 dark:border-b-neutral-750
      bg-neutral-50 dark:bg-neutral-900
        hover:bg-neutral-25 dark:hover:bg-neutral-875
        active:bg-white dark:active:bg-neutral-850
      hover:border-neutral-300 hover:border-l-neutral-400 hover:border-b-neutral-400 dark:hover:border-neutral-750 dark:hover:border-l-neutral-700 dark:hover:border-b-neutral-700
      active:shadow-solid-bottomleft active:shadow-neutral-500 dark:active:shadow-neutral-600
      ${paddingClassName ?? padding} ${text} italic ${className || ""}`}
    >
      {children}
    </button>
  );
}
export function LinkButton({
  children,
  ...attrs
}: {
  children: React.ReactNode;
} & JSX.IntrinsicElements["button"]): JSX.Element {
  return (
    <button
      {...attrs}
      className={`underline decoration-from-font ${attrs.className}`}
    >
      {children}
    </button>
  );
}
