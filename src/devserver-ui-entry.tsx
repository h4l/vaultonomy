import { QueryClient } from "@tanstack/query-core";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./css/main.css";
import { customiseTanstackQueryFocusManager } from "./tanstack-query";
import { AppContext, AppUI } from "./ui/App";
import { createVaultonomyStore } from "./ui/state/createVaultonomyStore";

customiseTanstackQueryFocusManager();

const vaultonomyStore = createVaultonomyStore({ isOnDevServer: true });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
    },
  },
});

const windowStoragePersister = createSyncStoragePersister({
  storage: window.sessionStorage,
});

export function DevServerRoot(): JSX.Element {
  return (
    <AppContext
      queryClient={queryClient}
      queryClientPersister={windowStoragePersister}
      vaultonomyStore={vaultonomyStore}
    >
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
