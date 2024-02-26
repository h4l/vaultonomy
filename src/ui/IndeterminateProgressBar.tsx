export function IndeterminateProgressBar({
  className,
  reverse = false,
}: {
  className?: string;
  reverse?: boolean;
}): JSX.Element {
  return (
    <div
      role="progressbar"
      className={`w-full h-1 bg-neutral-200 dark:bg-neutral-800 overflow-hidden relative
                  ${className ?? ""}`}
    >
      <div
        className={`absolute inset-y-0 inset-x-0 bg-neutral-300 dark:bg-neutral-700 origin-left scale-x-0 animate-indeterminate-progress-1 ${reverse ? "direction-reverse" : ""}`}
      />
      <div
        className={`absolute inset-y-0 inset-x-0 bg-neutral-400 dark:bg-neutral-600 origin-left scale-x-0 animate-indeterminate-progress-2 animate-delay-800 ${reverse ? "direction-reverse" : ""}`}
      />
    </div>
  );
}
