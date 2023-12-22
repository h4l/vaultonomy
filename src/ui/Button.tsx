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
      focus:outline-none focus-visible:outline-none focus-visible:outline-dashed focus-visible:outline-offset-4 focus-visible:outline-logo-background
      px-7 py-5
      text-4xl italic ${className || ""}`}
    >
      {/* Push down the baseline for better vertical centering. */}
      <span className="inline-block pt-[0.125em]">{children}</span>
    </button>
  );
}
