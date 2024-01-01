import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./css/main.css";
import { applyPolyfills } from "./polyfills";
import { App } from "./ui/App";

applyPolyfills();
const el = document.createElement("div");
document.body.append(el);
const root = createRoot(el);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
