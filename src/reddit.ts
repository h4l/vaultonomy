import { assert } from "./assert";
import { log } from "./logging";
import { AVAILABILITY_PORT_NAME } from "./messaging";
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

  const availabilityConnection = createAvailabilityConnection();
  const stopRedditInteractionConnections = handleRedditInteractionConnections(
    availabilityConnection,
  );

  const connectionOverlay = new ConnectionOverlay({
    onRemoved: () => stop && stop(),
  });
  connectionOverlay.render();

  return () => {
    stop = undefined;
    stopRedditInteractionConnections();
    availabilityConnection.disconnect();
    connectionOverlay.remove();
  };
}

export function createAvailabilityConnection(): chrome.runtime.Port {
  const port = browser.runtime.connect({
    name: AVAILABILITY_PORT_NAME.withRandomTag().toString(),
  });
  retroactivePortDisconnection.register(port);
  retroactivePortDisconnection.addRetroactiveDisconnectListener(port, () => {
    log.debug("availability Port disconnected");
    stop && stop();
  });
  // TODO: add explicit message handler to stop?
  return port;
}

export function handleRedditInteractionConnections(
  availabilityConnection: chrome.runtime.Port,
): Stop {
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

    // Shutdown all RPC connections when the availability connection drops.
    assert(availabilityConnection);
    retroactivePortDisconnection.addRetroactiveDisconnectListener(
      availabilityConnection,
      () => {
        log.debug(
          "disconnecting RPC Port due to availability Port disconnecting",
        );
        port.disconnect();
      },
    );
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
