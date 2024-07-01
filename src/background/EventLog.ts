import { TaggedEvent } from "../vaultonomy-rpc-spec";
import { Queue } from "./Queue";

/**
 * An ordered log of events with unique, sequential identifiers. We use these
 * sequential identifiers to replay events that were created prior to event
 * handlers being registered to see them live.
 *
 * @see SynchronisingEventEmitter
 */
export class EventLog<T extends TaggedEvent<U>, U = T["event"]> {
  readonly instanceId = crypto.randomUUID();
  #sequenceNumber: number = 0;
  readonly #events: Queue<T>;
  constructor(private readonly tag: (event: TaggedEvent<T["event"]>) => T) {
    this.#events = new Queue({ maxSize: 10 });
  }

  register(event: T["event"]): T {
    // We need tag() to satisfy tsc.
    const context: T = this.tag({
      type: "tagged",
      senderId: this.instanceId,
      order: this.#sequenceNumber++,
      event,
    });
    Object.freeze(context);
    this.#events.push(context);
    return context;
  }

  get events(): ReadonlyArray<T> {
    return this.#events.values;
  }
}
