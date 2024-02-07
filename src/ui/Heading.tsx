import { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

type Level = 2 | 3 | 4 | 5;

const DEFAULT_CLASSES: Record<Level, string> = {
  2: "my-8 text-5xl font-semibold",
  3: "my-6 text-4xl font-semibold",
  4: "my-6 text-3xl font-semibold",
  5: "my-3 text-2xl font-semibold",
};

export function Heading({
  id,
  className,
  children,
  level: _level,
  visualLevel: _visualLevel,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
  level?: Level;
  visualLevel?: Level;
}) {
  const level = _level ?? 2;
  const visualLevel = _visualLevel ?? level;
  const H = `h${level}` as keyof JSX.IntrinsicElements;

  return (
    <H id={id} className={twMerge(DEFAULT_CLASSES[visualLevel], className)}>
      {children}
    </H>
  );
}
