import { useContext } from "react";

import { DevServerContext } from "./DevServerContext";

export function isOnDevServer(): boolean {
  return useContext(DevServerContext);
}
