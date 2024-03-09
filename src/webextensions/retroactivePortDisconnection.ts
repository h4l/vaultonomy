import { Emitter, createNanoEvents } from "nanoevents";

import { assert } from "../assert";

interface PortState {
  hasDisconnected: boolean;
  emitter: Emitter<PortEvents>;
}
interface PortEvents {
  disconnected: (port: chrome.runtime.Port) => void;
}

type Unbind = () => void;

class PortDisconnectionListener {
  private readonly observedObjects = new WeakMap<
    chrome.runtime.Port,
    PortState
  >();

  constructor() {
    this.observedObjects = new WeakMap();
    this.onDisconnect = this.onDisconnect.bind(this);
  }

  private onDisconnect(port: chrome.runtime.Port): void {
    const portState = this.observedObjects.get(port);
    assert(portState, "received onDisconnect callback for unregistered Port");
    assert(
      !portState.hasDisconnected,
      "received onDisconnect callback for an already-disconnected Port",
    );
    portState.hasDisconnected = true;
    portState.emitter.emit("disconnected", port);
  }

  register(port: chrome.runtime.Port): chrome.runtime.Port {
    if (this.observedObjects.has(port)) {
      return port;
    }
    const portState: PortState = {
      hasDisconnected: false,
      emitter: createNanoEvents(),
    };
    this.observedObjects.set(port, portState);
    port.onDisconnect.addListener(this.onDisconnect);
    return port;
  }

  private requirePortState(
    port: chrome.runtime.Port,
    callerName: string,
  ): PortState {
    const portState: PortState | undefined = this.observedObjects.get(port);
    if (!portState) {
      throw new Error(
        `${callerName} was called with an unregistered port. Port disconnect ` +
          "events cannot fire reliably unless the port is " +
          "registered synchronously in the onConnect callback.",
      );
    }
    return portState;
  }

  /**
   * Return true if port already disconnected.
   */
  hasDisconnected(port: chrome.runtime.Port): boolean {
    return this.requirePortState(port, "hasDisconnected").hasDisconnected;
  }

  /**
   * Register a Port disconnect listener that is called immediately if the port
   * was disconnected before this call was made, or in the future if it's yet to
   * disconnect.
   *
   * Callbacks are always made asynchronously.
   */
  addRetroactiveDisconnectListener(
    port: chrome.runtime.Port,
    onDisconnect: (port: chrome.runtime.Port) => void,
  ): Unbind {
    const portState = this.requirePortState(
      port,
      "addRetroactiveDisconnectListener",
    );
    const boundOnDisconnect = onDisconnect.bind(undefined, port);
    if (portState.hasDisconnected) {
      const timeout = setTimeout(boundOnDisconnect, 0);
      return () => {
        clearTimeout(timeout);
      };
    }
    // Only listen for one event
    const unbind = portState.emitter.on("disconnected", () => {
      try {
        boundOnDisconnect();
      } finally {
        unbind();
      }
    });
    return unbind;
  }
}

/**
 * Handle asynchronously-registered Port disconnection events.
 *
 * This enables two features that Ports don't support directly:
 *
 * - asking a Port if it's already disconnected
 * - registering a disconnect handler after disconnection has happened, and
 *   having it still fire.
 *
 * In contrast, regular Port.onDisconnect listeners must be registered
 * synchronously as soon as a port is created/received. This is problematic if
 * the setup process for a Port connection is asynchronous — disconnect
 * listeners may not fire if they're registered after a delay, and this can
 * result in non-deterministic behaviour.
 */
export const retroactivePortDisconnection = new PortDisconnectionListener();
