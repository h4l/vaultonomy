import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./css/main.css";
import { applyPolyfills } from "./polyfills";
import { AppContext, AppUI } from "./ui/App";
import { createVaultonomyStore } from "./ui/state/createVaultonomyStore";

const vaultonomyStore = createVaultonomyStore({ isOnDevServer: true });

export function DevServerRoot(): JSX.Element {
  return (
    <AppContext vaultonomyStore={vaultonomyStore}>
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
