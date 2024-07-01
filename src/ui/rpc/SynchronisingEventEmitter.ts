import { withTimeout } from "viem";

import { assert } from "../../assert";
import { log as _log } from "../../logging";
import { TaggedEvent } from "../../vaultonomy-rpc-spec";

export const log = _log.getLogger("ui/rpc/SynchronisingEventEmitter");

// I'm not super-happy with this. The differences between running the dev-mode
// UI in a regular web page and the real UI in the extension mean that we can't
// use the same notification method for both. The simplest thing would be to use
// browser.runtime.sendMessage from the backend to notify the extension UI, and
// use the RPC notifications for the dev-mode UI (which can't receive extension
// messages as it's outside the extension). I'm favouring using the same
// mechanism for both, even though it makes the extension itself a little more
// complicated than it could be — I'd rather maintain one slightly more
// complicated thing than two separate notification mechanisms.

type SynchronisingState<T> = {
  state: "synchronising";
  operation: Promise<void>;
  queuedEvents: T[];
};

type EmittingState<T> = {
  state: "emitting";
  lastEmit: T | undefined;
};

/**
 * An event emitter which can pull in a log of past events to emit events that
 * were sent before this emitter was created.
 */
export class SynchronisingEventEmitter<
  T extends TaggedEvent<U>,
  U = T["event"],
> {
  private state: SynchronisingState<T> | EmittingState<T>;
  private readonly getEventLog: () => Promise<T[]>;
  private readonly emitEvent: (event: T) => void;
  private readonly syncTimeout: number = 1000;

  constructor({
    getEventLog,
    emitEvent,
    syncTimeout = 1000,
  }: {
    getEventLog: () => Promise<T[]>;
    emitEvent: (event: T) => void;
    syncTimeout?: number;
  }) {
    this.state = { state: "emitting", lastEmit: undefined };
    this.getEventLog = getEventLog;
    this.emitEvent = (event) => {
      if (this.#isStopped) return;
      emitEvent(event);
    };
    this.syncTimeout = syncTimeout;
  }

  private startLoggedEventSync(): SynchronisingState<T> {
    assert(this.state.state === "emitting");
    const emit = this.state;

    const queuedEvents: T[] = [];
    const operation = (async (): Promise<EmittingState<T>> => {
      const logEvents = await withTimeout(() => this.getEventLog(), {
        timeout: this.syncTimeout,
      }).catch<T[]>((error) => {
        log.warn("Failed to get event log from background:", error);
        return [];
      });

      const logSenderId = logEvents.at(0)?.senderId;
      const logLastOrder = logEvents.at(-1)?.order;
      let usableLogEvents: ReadonlyArray<T>;

      if (logLastOrder === undefined || logSenderId === undefined) {
        assert(logEvents.length === 0);
        usableLogEvents = logEvents;
      }

      // If we've fetched events from the same sender that we've already
      // emitted from, we can't emit any of them because they occur before
      // events we've already emitted, and any events after are now in
      // queuedEvents (or will be received subsequently).
      else if (logSenderId === emit.lastEmit?.senderId) {
        usableLogEvents = [];
        log.debug("log unusable, already emitted event with log senderId");
      }

      // We've fetched events from a new sender that we've not yet started
      // emitting from. Emit the logged events first, then any newer ones that
      // were received while we blocked to fetch the log.
      else {
        usableLogEvents = logEvents;
      }
      const allQueued = [
        ...usableLogEvents,
        ...queuedEvents.filter(
          (te) => logLastOrder === undefined || te.order > logLastOrder,
        ),
      ];
      log.debug(
        `${logEvents.length} events from log;`,
        `${queuedEvents.length} events from queue;`,
        `${allQueued.length} unique events`,
        allQueued,
      );

      for (const event of allQueued) this.emitEvent(event);
      return { state: "emitting", lastEmit: allQueued.at(-1) };
    })()
      .catch<EmittingState<T>>((error) => {
        log.warn("Failed to sync event log from background:", error);
        return { state: "emitting", lastEmit: undefined };
      })
      .then((emitting: EmittingState<T>) => {
        this.state = emitting;
      });

    return {
      state: "synchronising",
      queuedEvents,
      operation,
    };
  }

  syncLoggedEvents(): Promise<void> {
    if (this.#isStopped) return Promise.reject(new Error("stopped"));
    if (this.state.state !== "synchronising")
      this.state = this.startLoggedEventSync();
    return this.state.operation;
  }

  emitSoon(event: T): void {
    if (this.#isStopped) return;
    if (this.state.state === "synchronising") {
      this.state.queuedEvents.push(event);
    } else {
      this.state.lastEmit = event;
      this.emitEvent(event);
    }
  }

  #isStopped: boolean = false;
  stop(): void {
    this.#isStopped = true;
  }
}
