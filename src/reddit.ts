import { assert } from "./assert";
import { log } from "./logging";
import { createServerSession } from "./reddit/reddit-interaction-server";
import { REDDIT_INTERACTION_PORT_NAME } from "./reddit/reddit-interaction-spec";
import { ConnectionOverlay } from "./reddit/ui/connection-overlay";
import { bindPortToJSONRPCServer } from "./rpc/webextension-port-json-rpc";
import { browser } from "./webextension";
import { retroactivePortDisconnection } from "./webextensions/retroactivePortDisconnection";

type Stop = () => void;

let stop: Stop | undefined = undefined;

function isStarted(): boolean {
  return stop !== undefined;
}

function start(): Stop {
  if (isStarted()) {
    assert(false, "attempted to start() when already started");
  }

  const stopRedditInteractionConnections = handleRedditInteractionConnections();

  // TODO: remove this in due course, or at least make it non-modal so the page
  // can still be used.
  // TODO: introduce a timeout to close the connection if unused for some period?
  // This may not be necessary as the background service worker will itself stop
  // after 30s or so.
  const connectionOverlay = new ConnectionOverlay({
    onRemoved: () => stop && stop(),
  });
  connectionOverlay.render();

  return () => {
    stop = undefined;
    stopRedditInteractionConnections();
    connectionOverlay.remove();
  };
}

export function handleRedditInteractionConnections(): Stop {
  const onConnect = (port: chrome.runtime.Port): void => {
    log.debug("Port Connected:", port.name);
    retroactivePortDisconnection.register(port);
    if (!REDDIT_INTERACTION_PORT_NAME.matches(port.name)) {
      log.debug("Closing unexpected connection: ", port);
      port.disconnect();
      return;
    }

    log.debug("Starting JSONRPC server for port", port);
    const server = createServerSession();
    bindPortToJSONRPCServer({ port, server });
    retroactivePortDisconnection.addRetroactiveDisconnectListener(port, () => {
      log.debug("Stopping JSONRPC server for port", port);
    });
  };
  browser.runtime.onConnect.addListener(onConnect);
  return () => browser.runtime.onConnect.removeListener(onConnect);
}

export function main() {
  if (document.readyState === "complete") {
    stop = start();
    return;
  } else {
    document.addEventListener("readystatechange", () => {
      if (document.readyState === "complete") {
        stop = start();
      }
    });
  }
}
