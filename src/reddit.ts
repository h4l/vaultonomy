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
  const port = browser.runtime.connect({ name: "availability" });
  port.onDisconnect.addListener(() => {
    console.log("availability Port disconnected");
    stop();
  });
  // TODO: add explicit message handler to stop?
  return port;
}

export function handleRedditInteractionConnections() {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== REDDIT_INTERACTION) return;

    const server = createServerSession();
    bindPortToJSONRPCServer({ port, server });

    // Shutdown all RPC connections when the availability connection drops.
    availabilityConnection?.onDisconnect.addListener(() => {
      console.log(
        "disconnecting RPC Port due to availability Port disconnecting"
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
