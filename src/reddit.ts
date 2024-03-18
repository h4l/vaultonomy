import { assert } from "./assert";
import { log } from "./logging";
import { createServerSession } from "./reddit/reddit-interaction-server";
import { REDDIT_INTERACTION_PORT_NAME } from "./reddit/reddit-interaction-spec";
import { bindPortToJSONRPCServer } from "./rpc/webextension-port-json-rpc";
import { Stop } from "./types";
import { browser } from "./webextension";
import { retroactivePortDisconnection } from "./webextensions/retroactivePortDisconnection";

// We stop the content script if there are 0 connections for this long. Note
// that this only applies after the background service worker exits, and that
// only exists after about 30s of inactivity.
const idleTime = 1000 * 15;

let stop: Stop | undefined = undefined;

function isStarted(): boolean {
  return stop !== undefined;
}

function start(onIdle: () => void): Stop {
  if (isStarted()) {
    assert(false, "attempted to start() when already started");
  }

  const notifyIdleSoon = () => {
    assert(cancelIdleNotify === undefined);
    const notifyIdleTimeout = setTimeout(() => {
      log.debug(
        `Server became idle after no connections for ${idleTime / 1000}s`,
      );
      onIdle();
    }, idleTime);

    return () => {
      cancelIdleNotify = undefined;
      clearTimeout(notifyIdleTimeout);
    };
  };

  let cancelIdleNotify: Stop | undefined;

  const stopRedditInteractionConnections = handleRedditInteractionConnections(
    (count) => {
      if (count === 0) {
        cancelIdleNotify = notifyIdleSoon();
      } else {
        assert(count > 0);
        if (cancelIdleNotify) {
          cancelIdleNotify();
          cancelIdleNotify = undefined;
        }
      }
    },
  );

  return () => {
    if (cancelIdleNotify) cancelIdleNotify();
    stopRedditInteractionConnections();
  };
}

export function handleRedditInteractionConnections(
  connectionCountChanged: (count: number) => void,
): Stop {
  let connectionCount = 0;

  const onConnect = (port: chrome.runtime.Port): void => {
    log.debug("Port Connected:", port.name);
    retroactivePortDisconnection.register(port);
    if (!REDDIT_INTERACTION_PORT_NAME.matches(port.name)) {
      log.debug("Closing unexpected connection: ", port);
      port.disconnect();
      return;
    }

    log.debug("Starting JSONRPC server for port", port);
    connectionCountChanged(++connectionCount);

    const server = createServerSession();
    bindPortToJSONRPCServer({ port, server });
    retroactivePortDisconnection.addRetroactiveDisconnectListener(port, () => {
      log.debug("Stopping JSONRPC server for port", port);
      connectionCountChanged(--connectionCount);
    });
  };

  browser.runtime.onConnect.addListener(onConnect);
  connectionCountChanged(connectionCount);

  return () => {
    browser.runtime.onConnect.removeListener(onConnect);
  };
}

function ensureStarted(): void {
  if (isStarted()) {
    log.debug("start when already started, nothing to do");
    return;
  }
  stop = start(() => {
    assert(stop);
    stop();
    stop = undefined;
    log.debug("Stopped idle reddit interaction server");
  });
}

export function main() {
  if (document.readyState === "complete") {
    ensureStarted();
    return;
  } else {
    document.addEventListener("readystatechange", () => {
      if (document.readyState === "complete") {
        ensureStarted();
      }
    });
  }
}
