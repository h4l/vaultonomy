import { Emitter, createNanoEvents } from "nanoevents";

import { log as _log } from "../logging";

const log = _log.getLogger("rpc/connections");

export type Disconnect = () => void;
export type Connector<T> = (onDisconnect?: Disconnect) => [T, Disconnect];

export interface ManagedConnection<T> {
  // TODO: do we actually need this in practice? We currently have RedditProvider
  //   report disconnection, but now that we auto-reconnect, being disconnected
  //   is much less significant, as it's a normal part of operation. What's more
  //   significant is if we can't reconnect, but that seems better communicated
  //   with an exception from getConnection() or from a subsequent request via
  //   the connection than an emitted event.
  readonly emitter: Emitter<{ disconnected: (connection: T) => void }>;
  getConnection(): T;
  disconnect(instance?: T): void;
}

class MappedManagedConnection<T extends object, U extends object>
  implements ManagedConnection<U>
{
  readonly emitter: Emitter<{ disconnected: (connection: U) => void }>;
  private readonly forwardMap: WeakMap<T, U> = new WeakMap();
  private readonly reverseMap: WeakMap<U, T> = new WeakMap();
  constructor(
    private readonly connection: ManagedConnection<T>,
    private readonly map: (t: T) => U,
  ) {
    this.emitter = createNanoEvents();
    // TODO: do we need a way to unbind this or can we allow it to be GC'd with
    // this.connection?
    this.connection.emitter.on(
      "disconnected",
      this.onSourceDisconnected.bind(this),
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
    const connection = this.connection.getConnection();
    let mappedConnection = this.forwardMap.get(connection);
    if (mappedConnection) return mappedConnection;

    mappedConnection = this.map(this.connection.getConnection());
    this.forwardMap.set(connection, mappedConnection);
    this.reverseMap.set(mappedConnection, connection);
    return mappedConnection;
  }

  disconnect(instance?: U | undefined): void {
    return this.connection.disconnect(
      instance && this.reverseMap.get(instance),
    );
  }
}

export function mapConnection<T extends object, U extends object>(
  connection: ManagedConnection<T>,
  map: (t: T) => U,
): ManagedConnection<U> {
  return new MappedManagedConnection(connection, map);
}

export class ReconnectingManagedConnection<T> implements ManagedConnection<T> {
  public readonly emitter: Emitter<{ disconnected: (connection: T) => void }>;
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
    this.disconnectConnection = () => {
      disconnect();
      this.emitter.emit("disconnected", connection);
    };
    return connection;
  }

  getConnection(): T {
    return this.connection || this.connect();
  }

  disconnect(expected?: T | undefined): void {
    if (expected && expected !== this.connection) return;
    this.connection = undefined;
    this.disconnectConnection && this.disconnectConnection();
  }
}
