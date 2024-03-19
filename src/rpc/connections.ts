import { Emitter, createNanoEvents } from "nanoevents";

import { VaultonomyError } from "../VaultonomyError";
import { assert } from "../assert";
import { log as _log } from "../logging";
import { Unbind, isPromise } from "../types";

const log = _log.getLogger("rpc/connections");

export class CouldNotConnect extends VaultonomyError {}

export type Disconnect = () => void;
export type Connector<T> = (onDisconnect?: Disconnect) => [T, Disconnect];
export type AsyncConnector<T> = (
  onDisconnect?: Disconnect,
) => Promise<[T, Disconnect]>;

export type AnyManagedConnection<T> =
  | ManagedConnection<T>
  | AsyncManagedConnection<T>;

export type ManagedConnectionEvents<T> = {
  disconnected: (connection: T) => void;
  stopped: () => void;
};

export interface ManagedConnection<T> {
  // TODO: do we actually need this in practice? We currently have RedditProvider
  //   report disconnection, but now that we auto-reconnect, being disconnected
  //   is much less significant, as it's a normal part of operation. What's more
  //   significant is if we can't reconnect, but that seems better communicated
  //   with an exception from getConnection() or from a subsequent request via
  //   the connection than an emitted event.
  readonly emitter: Emitter<ManagedConnectionEvents<T>>;
  getConnection(): T;
  readonly isStopped: boolean;
  stop(): void;
  disconnect(instance: T): void;
}

export interface AsyncManagedConnection<T> {
  // TODO: do we actually need this in practice? We currently have RedditProvider
  //   report disconnection, but now that we auto-reconnect, being disconnected
  //   is much less significant, as it's a normal part of operation. What's more
  //   significant is if we can't reconnect, but that seems better communicated
  //   with an exception from getConnection() or from a subsequent request via
  //   the connection than an emitted event.
  readonly emitter: Emitter<ManagedConnectionEvents<T>>;
  getConnection(): Promise<T>;
  readonly isStopped: boolean;
  stop(): void;
  disconnect(instance?: T | Promise<T>): void;
}

function ensureNotStopped(mc: ManagedConnection<any>): void {
  if (mc.isStopped) throw new CouldNotConnect("stopped");
}

class MappedManagedConnection<T extends object, U extends object>
  implements ManagedConnection<U>
{
  readonly emitter: Emitter<ManagedConnectionEvents<U>>;
  private readonly forwardMap: WeakMap<T, U> = new WeakMap();
  private readonly reverseMap: WeakMap<U, T> = new WeakMap();

  #unbindUpstreamDisconnected: Unbind;
  #unbindUpstreamStopped: Unbind;

  constructor(
    private readonly connection: ManagedConnection<T>,
    private readonly map: (t: T) => U,
  ) {
    this.emitter = createNanoEvents();
    // TODO: do we need a way to unbind this or can we allow it to be GC'd with
    // this.connection?
    this.#unbindUpstreamDisconnected = this.connection.emitter.on(
      "disconnected",
      this.onSourceDisconnected.bind(this),
    );
    this.#unbindUpstreamStopped = this.connection.emitter.on(
      "stopped",
      this.stop.bind(this),
    );
  }

  private onSourceDisconnected(sourceConnection: T) {
    const connection = this.forwardMap.get(sourceConnection);
    // can be GC'd, which is fine
    if (!connection) {
      log.debug("sourceConnection disconnected without mapped entry");
      return;
    }
    this.emitter.emit("disconnected", connection);
  }

  getConnection(): U {
    ensureNotStopped(this);
    const connection = this.connection.getConnection();
    let mappedConnection = this.forwardMap.get(connection);
    if (mappedConnection) return mappedConnection;

    mappedConnection = this.map(connection);
    this.forwardMap.set(connection, mappedConnection);
    this.reverseMap.set(mappedConnection, connection);
    return mappedConnection;
  }

  get isStopped(): boolean {
    return this.#isStopped;
  }

  #isStopped: boolean = false;
  stop(): void {
    if (this.#isStopped) return;
    this.#isStopped = true;
    this.connection.stop();
    this.#unbindUpstreamDisconnected();
    this.#unbindUpstreamStopped();
    this.emitter.emit("stopped");
  }

  disconnect(instance: U): void {
    const upstreamConnection = this.reverseMap.get(instance);
    if (upstreamConnection) this.connection.disconnect(upstreamConnection);
  }
}

export function mapConnection<T extends object, U extends object>(
  connection: ManagedConnection<T>,
  map: (t: T) => U,
): ManagedConnection<U> {
  return new MappedManagedConnection(connection, map);
}

export class ReconnectingManagedConnection<T> implements ManagedConnection<T> {
  public readonly emitter: Emitter<ManagedConnectionEvents<T>>;
  private connection: T | undefined;
  private disconnectConnection: Disconnect | undefined;

  constructor(private readonly connector: Connector<T>) {
    this.emitter = createNanoEvents();
  }

  private connect(): T {
    const [connection, disconnect] = this.connector(() => {
      this.disconnect(connection);
    });
    this.connection = connection;
    let disconnected = false;
    this.disconnectConnection = () => {
      if (disconnected) return;
      disconnected = true;

      disconnect();
      this.emitter.emit("disconnected", connection);
    };
    return connection;
  }

  getConnection(): T {
    ensureNotStopped(this);
    return this.connection ?? this.connect();
  }

  #isStopped: boolean = false;
  get isStopped(): boolean {
    return this.#isStopped;
  }

  stop(): void {
    if (this.#isStopped) return;
    this.#isStopped = true;
    if (this.connection) this.disconnect(this.connection);
    this.emitter.emit("stopped");
  }

  disconnect(connection: T): void {
    if (connection !== this.connection) return;
    this.connection = undefined;
    if (this.disconnectConnection) {
      this.disconnectConnection();
      this.disconnectConnection = undefined;
    }
  }
}

type ConnectedAsyncConnectionState<T> = {
  disconnected: boolean;
  connection: T;
  disconnect: Disconnect;
};
type PendingAsyncConnectionState<T> = {
  disconnected: boolean;
  connection?: T | undefined;
  disconnect?: Disconnect | undefined;
};
type AnyAsyncConnectionState<T> =
  | PendingAsyncConnectionState<T>
  | ConnectedAsyncConnectionState<T>;

function isConnectedAsyncConnectionState<T>(
  state: AnyAsyncConnectionState<T>,
): state is ConnectedAsyncConnectionState<T> {
  return !!(state.connection && state.disconnect);
}

/**
 * Create a connection asynchronously, and cache it until it disconnects.
 *
 * getConnection() returns the same connection instance until it disconnects.
 * A separate instances of ReconnectingAsyncManagedConnection (sharing the same
 * AsyncConnector) must be used when distinct connections are required.
 */
export class ReconnectingAsyncManagedConnection<T extends object>
  implements AsyncManagedConnection<T>
{
  public readonly emitter: Emitter<ManagedConnectionEvents<T>>;
  private futureConnection: Promise<T> | undefined;

  private asyncConnectionState: WeakMap<
    T | Promise<T>,
    AnyAsyncConnectionState<T>
  >;

  constructor(private readonly connector: AsyncConnector<T>) {
    this.emitter = createNanoEvents();
    this.asyncConnectionState = new WeakMap();
  }

  private async connect(state: PendingAsyncConnectionState<T>): Promise<T> {
    const [connection, disconnect] = await this.connector(() => {
      this.disconnect(connection);
    });

    state.connection = connection;
    state.disconnect = () => {
      disconnect();
      this.emitter.emit("disconnected", connection);
    };

    if (state.disconnected) {
      state.disconnect();
      throw new CouldNotConnect("disconnected while connecting");
    }

    // We need to link the loaded connection to the state so that disconnect()
    // can find it later to disconnect.
    this.asyncConnectionState.set(connection, state);
    return connection;
  }

  getConnection(): Promise<T> {
    if (this.isStopped) return Promise.reject(new CouldNotConnect("stopped"));

    // Don't re-use an existing connection if it's been disconnected
    if (this.futureConnection) {
      const state = this.asyncConnectionState.get(this.futureConnection);
      if (state?.disconnected) {
        this.futureConnection = undefined;
      }
    }

    if (!this.futureConnection) {
      // all calls getConnection() calls share the same connection. Multiple
      // instances of this class sharing the same AsyncConnector must be used if
      // distinct connections are required.

      const state: PendingAsyncConnectionState<T> = { disconnected: false };
      const futureConnection = (this.futureConnection = this.connect(state));
      this.asyncConnectionState.set(futureConnection, state);

      // Clear failed connection attempts so that subsequent calls retry
      futureConnection.catch((e) => {
        log.debug("dropping rejected connect() promise:", e);
        if (futureConnection === this.futureConnection) {
          this.futureConnection = undefined;
        }
      });
    }
    return this.futureConnection;
  }

  #isStopped: boolean = false;
  get isStopped(): boolean {
    return this.#isStopped;
  }

  stop(): void {
    if (this.#isStopped) return;
    this.#isStopped = true;
    if (this.futureConnection) {
      this.disconnect(this.futureConnection);
    }
    this.emitter.emit("stopped");
  }

  /**
   * Disconnect a connected or pending connection from getConnection().
   */
  disconnect(connection: T | Promise<T>): void {
    const state = this.asyncConnectionState.get(connection);
    if (!state) {
      if (!isPromise(connection)) return;
      // external derived promise — disconnect when resolved
      connection
        .then((c) => {
          assert(!isPromise(c));
          this.disconnect(c);
        })
        .catch(() => {});
      return;
    }

    if (isConnectedAsyncConnectionState(state)) {
      if (state.disconnected) return;
      state.disconnected = true;
      state.disconnect();
    } else {
      // Not loaded yet - connect() will disconnect when it is
      assert(!state.connection);
      assert(!state.disconnect);
      state.disconnected = true;
    }
    // TODO: is it worth removing things from the WeakMap?
  }
}
