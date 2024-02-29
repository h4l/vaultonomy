import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/query-core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./css/main.css";
import { eip6963AnnounceCrossExtensionMetaMaskProvider } from "./ethereum/eip6963AnnounceCrossExtensionMetaMaskProvider";
import { log } from "./logging";
import { customiseTanstackQueryFocusManager } from "./tanstack-query";
import { App } from "./ui/App";
import { ExtensionAsyncStorage } from "./ui/state/ExtensionAsyncStorage";
import { createVaultonomyStore } from "./ui/state/createVaultonomyStore";
import { browser } from "./webextension";

// TODO: check if we actually benefit from this outside the dev server.
customiseTanstackQueryFocusManager();

eip6963AnnounceCrossExtensionMetaMaskProvider()
  .then((result) =>
    log.debug(
      `eip6963AnnounceCrossExtensionMetaMaskProvider: ${result.result}`,
    ),
  )
  .catch((error) =>
    log.error("Failed to detect/announce cross-extension MetaMask", error),
  );

const vaultonomyStore = createVaultonomyStore();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
    },
  },
});

const extensionStoragePersister = createAsyncStoragePersister({
  storage: new ExtensionAsyncStorage(browser.storage.session),
});

const el = document.createElement("div");
document.body.append(el);
const root = createRoot(el);
root.render(
  <StrictMode>
    <App
      queryClient={queryClient}
      queryClientPersister={extensionStoragePersister}
      vaultonomyStore={vaultonomyStore}
    />
  </StrictMode>,
);
