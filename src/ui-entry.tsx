import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./css/fonts.css";
import "./css/main.css";
import App from "./ui/App";

const el = document.createElement("div");
document.body.append(el);
const root = createRoot(el);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
