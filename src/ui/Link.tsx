import { ReactNode, useContext } from "react";

import { ScreenReaderOnlyContext } from "./a11y";

export function Link({
  href,
  toId,
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
} & ({ href: string; toId?: undefined } | { href?: undefined; toId: string })) {
  const isScreenReaderOnlyContext = useContext(ScreenReaderOnlyContext);

  const params =
    href === undefined ?
      { href: `#${encodeURIComponent(toId)}` }
    : { target: "_blank", href };

  return (
    <a
      {...params}
      // prevent tab-focusing links in invisible sr-only areas
      tabIndex={isScreenReaderOnlyContext ? -1 : undefined}
      rel="noreferrer"
      className={`underline underline-offset-2 decoration-from-font visited:decoration-double ${
        className || ""
      }`}
    >
      {children}
    </a>
  );
}
