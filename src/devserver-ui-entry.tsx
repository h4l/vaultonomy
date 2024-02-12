import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./css/main.css";
import { applyPolyfills } from "./polyfills";
import { AppContext, AppUI } from "./ui/App";

export function DevServerRoot(): JSX.Element {
  return (
    <AppContext isOnDevServer={true}>
      <ReactQueryDevtools initialIsOpen={false} />
      <AppUI />
    </AppContext>
  );
}

applyPolyfills();
const el = document.createElement("div");
document.body.append(el);
const root = createRoot(el);
root.render(
  <StrictMode>
    <DevServerRoot />
  </StrictMode>,
);
