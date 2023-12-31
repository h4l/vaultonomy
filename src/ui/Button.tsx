export function Button({
  children,
  className,
}: {
  className?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      className={`border rounded-md border-neutral-200 border-l-neutral-300 border-b-neutral-300
        dark:border-neutral-800 dark:border-l-neutral-750 dark:border-b-neutral-750
      bg-neutral-50 dark:bg-neutral-900
        hover:bg-neutral-25 dark:hover:bg-neutral-875
        active:bg-white dark:active:bg-neutral-850
      hover:border-neutral-300 hover:border-l-neutral-400 hover:border-b-neutral-400 dark:hover:border-neutral-750 dark:hover:border-l-neutral-700 dark:hover:border-b-neutral-700
      active:shadow-solid-bottomleft active:shadow-neutral-500 dark:active:shadow-neutral-600
      px-7 py-5 pt-[1.375]
      text-4xl italic ${className || ""}`}
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
