/*
- Use sendBeacon https://www.w3.org/TR/beacon/#sendbeacon-method
  to send events on shutdown
- Send when visibilityState transitions to hidden

*/
import { Emitter, createNanoEvents } from "nanoevents";
import { z } from "zod";

import { log } from "../logging";
import { AnyEventSchema, AnyPayload } from "./payload_schemas";

export type EventQueueEvents<EventSchemaT extends AnyEventSchema> = {
  eventAdded(
    event: z.infer<EventSchemaT>,
    queue: EventQueue<EventSchemaT>,
  ): void;
  eventDropped(
    event: z.infer<EventSchemaT>,
    queue: EventQueue<EventSchemaT>,
  ): void;
};

export type EventQueueOptions = {
  maxBufferSize?: number;
};

export class EventQueue<EventSchemaT extends AnyEventSchema> {
  readonly emitter: Emitter<EventQueueEvents<EventSchemaT>> =
    createNanoEvents();
  private readonly buffer: z.infer<EventSchemaT>[] = [];
  readonly maxBufferSize: number | undefined;
  constructor(
    readonly eventSchema: EventSchemaT,
    options: EventQueueOptions = {},
  ) {
    if ((options.maxBufferSize ?? 0) < 1)
      throw new Error("maxBufferSize must be <= 0");
    this.maxBufferSize = options.maxBufferSize;
  }

  addEvent(event: z.input<EventSchemaT>): void {
    const parsedEvent = this.eventSchema.parse(event);
    if (this.size() >= (this.maxBufferSize ?? Number.MAX_SAFE_INTEGER)) {
      this.emitter.emit("eventDropped", parsedEvent, this);
    }
    this.buffer.push(parsedEvent);
    this.emitter.emit("eventAdded", parsedEvent, this);
  }

  size(): number {
    return this.buffer.length;
  }

  removeEvents(count: number): z.infer<EventSchemaT>[] {
    if (count < 0) throw new Error("count must be >= 0");
    return this.buffer.splice(0, count);
  }
}

export type EventSenderOptions<EventT> = {
  endpoint: string;
  api_secret: string;
  measurement_id: string;
  payloadBuilder: PayloadBuilder<EventT>;
};

export const MAX_PAYLOAD_EVENTS = 25;

export class EventSender<EventSchemaT extends AnyEventSchema> {
  readonly endpoint: string;
  readonly api_secret: string;
  readonly measurement_id: string;
  readonly payloadBuilder: PayloadBuilder<z.infer<EventSchemaT>>;
  readonly eventQueue: EventQueue<EventSchemaT>;

  constructor(
    eventQueue: EventQueue<EventSchemaT>,
    options: EventSenderOptions<z.infer<EventSchemaT>>,
  ) {
    this.eventQueue = eventQueue;
    this.payloadBuilder = options.payloadBuilder;
    this.endpoint = options.endpoint;
    this.measurement_id = options.measurement_id;
    this.api_secret = options.api_secret;
    this.start();
  }

  getFullUrl(): string {
    const url = new URL(this.endpoint);
    url.searchParams.set("measurement_id", this.measurement_id);
    url.searchParams.set("api_secret", this.api_secret);
    return url.toString();
  }

  #stop: (() => void) | undefined;
  private start() {
    if (this.#stop) return;

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        this.sendQueuedEvents({ minEvents: 1 });
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const stopEventAdded = this.eventQueue.emitter.on("eventAdded", () => {
      this.sendQueuedEvents({ minEvents: MAX_PAYLOAD_EVENTS });
    });

    this.#stop = () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopEventAdded();
    };
  }

  sendQueuedEvents({ minEvents = 1 }: { minEvents?: number }): void {
    if (minEvents < 1 || minEvents > MAX_PAYLOAD_EVENTS) {
      throw new Error(
        `minEvents must be > 0 and <= ${MAX_PAYLOAD_EVENTS}: ${minEvents}`,
      );
    }
    while (this.eventQueue.size() > minEvents) {
      const events = this.eventQueue.removeEvents(MAX_PAYLOAD_EVENTS);
      this.sendEvents(events);
    }
  }

  private sendEvents(events: z.infer<EventSchemaT>[]): void {
    let payload: AnyPayload;
    try {
      payload = this.payloadBuilder.buildPayload(events);
    } catch (e) {
      log.error(
        "Failed to build payload from events, these events will be dropped:",
        events,
      );
      return;
    }

    const body = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });
    if (!navigator.sendBeacon(this.getFullUrl(), body)) {
      log.warn("navigator.sendBeacon refused to send event payload:", payload);
    }
  }

  async [Symbol.dispose]() {
    this.#stop && this.#stop();
  }
}

export interface PayloadBuilder<EventT> {
  buildPayload(events: EventT[]): AnyPayload;
}
