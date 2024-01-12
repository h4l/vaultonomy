import { ReactNode } from "react";

export function Heading({
  className,
  children,
  level: _level,
}: {
  className?: string;
  children: ReactNode;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}) {
  const level = _level ?? 2;
  // Note: could do dynamic elements like this, but we need to explicitly style
  // each variant anyway.
  // const H = `h${level ?? 2}` as keyof JSX.IntrinsicElements;
  // return <H ...>...</H>

  switch (level) {
    case 2:
      return (
        <h2 className={`my-8 text-5xl font-semibold ${className || ""}`}>
          {children}
        </h2>
      );
    default:
      throw new Error("Level not implemented: " + level);
  }
}
