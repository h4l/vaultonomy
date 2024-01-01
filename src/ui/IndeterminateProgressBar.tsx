export function IndeterminateProgressBar({
  className,
}: {
  className?: string;
}): JSX.Element {
  return (
    <div
      role="progressbar"
      className={`w-full h-1 bg-neutral-200 dark:bg-neutral-800 overflow-hidden relative
                  ${className ?? ""}`}
    >
      <div className="absolute left-0 top-0 bg-neutral-300 dark:bg-neutral-700 w-full h-full origin-left scale-x-0 animate-indeterminate-progress-1" />
      <div className="absolute left-0 top-0 bg-neutral-400 dark:bg-neutral-600 w-full h-full origin-left scale-x-0 animate-indeterminate-progress-2 animate-delay-800" />
    </div>
  );
}
