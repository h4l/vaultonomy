import { JSONRPCServerMiddleware } from "json-rpc-2.0";

import { log } from "../logging";

/**
 * Have the browser warn before closing a tab while the server is handling a
 * request.
 *
 * When 1 or more requests are running, this middleware adds a beforeunload
 * event handler to cause a confirmation dialog to pop up when closing the tab.
 */
export const tabCloseWarningMiddleware = <
  ServerParams = unknown,
>(): JSONRPCServerMiddleware<ServerParams> => {
  const warnOnUnload = (e: Event) => {
    log.info(
      "Warning on tab close because Vaultonomy is making request from this tab",
    );
    e.preventDefault();
  };
  let inFlightRequests = 0;

  return async (next, request, serverParams) => {
    try {
      if (inFlightRequests++ === 0) {
        window.addEventListener("beforeunload", warnOnUnload);
      }

      return await next(request, serverParams);
    } finally {
      if (--inFlightRequests === 0) {
        window.removeEventListener("beforeunload", warnOnUnload);
      }
    }
  };
};
