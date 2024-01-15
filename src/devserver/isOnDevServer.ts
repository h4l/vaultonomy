import { useContext } from "react";

import { DevServerContext } from "./DevServerContext";

export function useIsOnDevServer(): boolean {
  return useContext(DevServerContext);
}
