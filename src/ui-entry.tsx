import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./css/main.css";
import { eip6963AnnounceCrossExtensionMetaMaskProvider } from "./ethereum/eip6963AnnounceCrossExtensionMetaMaskProvider";
import { log } from "./logging";
import { applyPolyfills } from "./polyfills";
import { App } from "./ui/App";

eip6963AnnounceCrossExtensionMetaMaskProvider()
  .then((result) =>
    log.debug(
      `eip6963AnnounceCrossExtensionMetaMaskProvider: ${result.result}`,
    ),
  )
  .catch((error) =>
    log.error("Failed to detect/announce cross-extension MetaMask", error),
  );

applyPolyfills();
const el = document.createElement("div");
document.body.append(el);
const root = createRoot(el);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
