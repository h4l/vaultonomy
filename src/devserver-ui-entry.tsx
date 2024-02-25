import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./css/main.css";
import { customiseTanstackQueryFocusManager } from "./tanstack-query";
import { AppContext, AppUI } from "./ui/App";
import { createVaultonomyStore } from "./ui/state/createVaultonomyStore";

customiseTanstackQueryFocusManager();

const vaultonomyStore = createVaultonomyStore({ isOnDevServer: true });

export function DevServerRoot(): JSX.Element {
  return (
    <AppContext vaultonomyStore={vaultonomyStore}>
      {import.meta.env.VITE_TANSTACK_QUERY_DEV_TOOLS ?
        <ReactQueryDevtools initialIsOpen={false} />
      : undefined}
      <AppUI />
    </AppContext>
  );
}

const el = document.createElement("div");
document.body.append(el);
const root = createRoot(el);
root.render(
  <StrictMode>
    <DevServerRoot />
  </StrictMode>,
);
