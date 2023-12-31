import { ReactNode } from "react";

export function Link({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
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
