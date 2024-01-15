import { log } from "./logging";
import { availabilityPortName } from "./messaging";
import { createServerSession } from "./reddit/reddit-interaction-server";
import { REDDIT_INTERACTION } from "./reddit/reddit-interaction-spec";
import { ConnectionOverlay } from "./reddit/ui/connection-overlay";
import { bindPortToJSONRPCServer } from "./rpc/webextension-port-json-rpc";
import { browser } from "./webextension";

let availabilityConnection: chrome.runtime.Port | undefined;
let connectionOverlay: ConnectionOverlay | undefined;

function isStarted(): boolean {
  return availabilityConnection !== undefined;
}

function start() {
  if (isStarted()) {
    console.warn("attempted to start() when already started");
    return;
  }

  availabilityConnection = createAvailabilityConnection();
  handleRedditInteractionConnections();

  connectionOverlay = new ConnectionOverlay({
    onRemoved: () => isStarted() && stop(),
  });
  connectionOverlay.render();
}

function stop() {
  availabilityConnection?.disconnect();
  availabilityConnection = undefined;

  connectionOverlay?.remove();
  connectionOverlay = undefined;
}

export function createAvailabilityConnection(): chrome.runtime.Port {
  const port = browser.runtime.connect({ name: availabilityPortName });
  port.onDisconnect.addListener(() => {
    log.debug("availability Port disconnected");
    stop();
  });
  // TODO: add explicit message handler to stop?
  return port;
}

export function handleRedditInteractionConnections() {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== REDDIT_INTERACTION) {
      log.debug("Closing unexpected connection: ", port);
      port.disconnect();
      return;
    }

    log.debug("Starting JSONRPC server for port", port);
    const server = createServerSession();
    bindPortToJSONRPCServer({ port, server });
    port.onDisconnect.addListener(() => {
      log.debug("Stopping JSONRPC server for port", port);
    });

    // Shutdown all RPC connections when the availability connection drops.
    availabilityConnection?.onDisconnect.addListener(() => {
      log.debug(
        "disconnecting RPC Port due to availability Port disconnecting",
      );
      port.disconnect();
    });
  });
}

export function main() {
  if (document.readyState === "complete") {
    start();
    return;
  }
  document.addEventListener("readystatechange", () => {
    if (document.readyState === "complete") {
      start();
    }
  });
}
