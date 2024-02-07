import { ReactNode, useContext } from "react";

import { ScreenReaderOnlyContext } from "./a11y";

export function Link({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const isScreenReaderOnlyContext = useContext(ScreenReaderOnlyContext);

  return (
    <a
      // prevent tab-focusing links in invisible sr-only areas
      tabIndex={isScreenReaderOnlyContext ? -1 : undefined}
      target="_blank"
      rel="noreferrer"
      href={href}
      className={`underline decoration-from-font visited:decoration-double ${
        className || ""
      }`}
    >
      {children}
    </a>
  );
}
