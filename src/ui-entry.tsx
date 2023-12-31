import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./css/main.css";
import { applyPolyfills } from "./polyfills";
import { App } from "./ui/App";
import { WagmiConfigManager } from "./wagmi";

applyPolyfills();
const el = document.createElement("div");
document.body.append(el);
const root = createRoot(el);
root.render(
  <StrictMode>
    <App wagmiConfigManager={new WagmiConfigManager()} />
  </StrictMode>,
);
