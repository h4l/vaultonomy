import { ReactNode } from "react";

export function Heading({ children }: { children: ReactNode }) {
  return <h2 className="my-8 text-5xl font-semibold">{children}</h2>;
}
