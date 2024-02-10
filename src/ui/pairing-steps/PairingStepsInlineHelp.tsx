import { ReactNode } from "react";

import { HelpMessageProps, WithInlineHelp } from "../Help";

export function PairingStepsInlineHelp({
  iconOffsetTop,
  iconOffsetLeft,
  children,
  ...props
}: {
  iconOffsetLeft?: string;
  iconOffsetTop?: string;
  children: ReactNode;
} & HelpMessageProps) {
  return (
    <WithInlineHelp
      idleBackgroundClasses="bg-neutral-100 dark:bg-neutral-850"
      sr-help-order="after-content"
      iconOffsetTop={iconOffsetTop ?? "0.75rem"}
      iconOffsetLeft={iconOffsetLeft ?? "-0.6rem"}
      {...props}
    >
      {children}
    </WithInlineHelp>
  );
}
