import { ReactNode } from "react";

export function Heading({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <h2 className={`my-8 text-5xl font-semibold ${className || ""}`}>
      {children}
    </h2>
  );
}
