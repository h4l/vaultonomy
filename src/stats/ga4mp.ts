import debounce from "lodash.debounce";
import { z } from "zod";

import { log } from "../logging";
import { AnyPayload } from "./payload_schemas";

export type GA4MPOptions = {
  endpoint: string;
  measurementId: string;
  apiSecret: string;
  clientId: string;
  userProperties?:
    | Record<string, string | number>
    | Iterable<[string, string | number]>;
};

export interface GA4Event<
  NameT extends string = string,
  ParamsT extends Record<string, string | number> = Record<
    string,
    string | number
  >,
  ItemsT extends Record<string, string | number>[] = Record<
    string,
    string | number
  >[],
> {
  name: NameT;
  params?: ParamsT;
  items?: ItemsT;
}

type EventGroup<EventT> = { time: number; events: EventT[] };

/**
 * A client that sends events to a GA4 Measurement Protocol endpoint.
 *
 * Events are grouped together and sent in batches.
 */
export class GA4MPClient<EventT extends GA4Event = GA4Event> {
  readonly endpoint: string;
  readonly measurementId: string;
  readonly apiSecret: string;
  readonly clientId: string;
  readonly userProperties: Map<string, string | number>;

  /** The maximum number of events each GA4MP payload can contain. */
  readonly maxPayloadEvents: number = 25;

  /** Events that occur within this number of milliseconds from each other are
   * grouped and considered to occur at the time of the first event.
   *
   * Grouping events allows for multiple events to be sent in a single request,
   * which reduces the overhead.
   */
  readonly eventGroupWindowMillis = 50;

  /** The maximum number of events to store up before clearing them by sending
   * to the endpoint (even if `sendDebounceWindowMillis` has not elapsed). */
  readonly maxLoggedEvents = 200;

  /** The length of time to wait for more events to appear before sending queued
   * groups of events. The timer is reset each time new events appear.
   *
   * We use 20 seconds to ensure events recorded in the background service
   * worker are not lost when it gets killed after 30s of inactivity.
   */
  readonly sendDebounceWindowMillis = 1000 * 20;

  #loggedEventGroups: EventGroup<EventT>[] = [];
  #loggedEventCount = 0;
  #sendQueuedEventsSoon: ReturnType<typeof debounce<() => void>>;

  constructor(options: GA4MPOptions) {
    this.endpoint = options.endpoint;
    this.measurementId = options.measurementId;
    this.apiSecret = options.apiSecret;
    this.clientId = options.clientId;
    this.userProperties = new Map(
      options.userProperties === undefined ? []
      : Symbol.iterator in options.userProperties ? options.userProperties
      : Object.entries(options.userProperties),
    );

    this.#sendQueuedEventsSoon = debounce(
      this.sendQueuedEvents.bind(this),
      this.sendDebounceWindowMillis,
      { leading: false, trailing: true },
    );

    this.start();
  }

  private clearLoggedEvents(): void {
    this.#loggedEventGroups = [];
    this.#loggedEventCount = 0;
  }

  #stop: (() => void) | undefined;
  /** Bind event listeners needed to operate. */
  private start() {
    if (this.#stop) return;

    // Flush the queue when our UI becomes hidden. This ensures the UI doesn't
    // get killed without sending events.
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        this.#sendQueuedEventsSoon.flush();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    this.#stop = () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }

  /** Record an event to be sent to the endpoint.
   *
   * The event will be grouped with other events that are close enough together
   * in time, and sent as a batch.
   */
  logEvent(...events: EventT[]) {
    this.#loggedEventGroups.push({ time: Date.now(), events });
    this.#loggedEventCount += events.length;

    if (this.#loggedEventCount >= this.maxLoggedEvents) {
      this.sendQueuedEvents();
    } else {
      this.#sendQueuedEventsSoon();
    }
  }

  /** Re-pack logged events into groups to maximise the number of events per
   * GA4MP request. Events are grouped if they're within the
   * `eventGroupWindowMillis` from the first event in of each group.
   */
  private *groupUnsentEventGroupsForSending(): Generator<EventGroup<EventT>> {
    let time = 0;
    let events: EventT[] = [];

    for (const group of this.#loggedEventGroups) {
      if (group.time > time + this.eventGroupWindowMillis) {
        if (events.length > 0) yield { time, events };
        time = group.time;
      }

      for (const event of group.events) {
        events.push(event);
        if (events.length >= this.maxPayloadEvents) {
          yield { time, events };
          events = [];
        }
      }
    }
    if (events.length > 0) yield { time, events };
  }

  /** Immediately send any events previously recorded with `logEvent()`. */
  sendQueuedEvents(): void {
    for (const group of this.groupUnsentEventGroupsForSending()) {
      const rawPayload = this.buildPayload(group.time, group.events);
      const validatedPayload = AnyPayload.safeParse(rawPayload);

      if (!validatedPayload.success) {
        log.error(
          "Failed to build GA4MP payload: Events do not conform to GA4MP limitations:",
          validatedPayload.error.flatten(),
          "; payload:",
          rawPayload,
        );
      } else {
        this.sendPayload(validatedPayload.data);
      }
    }

    this.clearLoggedEvents();
  }

  async [Symbol.dispose]() {
    this.#sendQueuedEventsSoon.flush();
    this.#stop && this.#stop();
  }

  /** The endpoint URL with the GA4MP `measurement_id` and `api_secret` params. */
  private getFullUrl(): string {
    const url = new URL(this.endpoint);
    url.searchParams.set("measurement_id", this.measurementId);
    url.searchParams.set("api_secret", this.apiSecret);
    return url.toString();
  }

  /** Send a GA4MP payload to the endpoint.
   *
   * We use navigator.sendBeacon() rather than fetch, as it's intended for non
   * time critical requests that can occur in the background, without a
   * response. The browser can send these in the background after a tab is
   * closed without blocking a tab.
   */
  private sendPayload(payload: AnyPayload): void {
    const body = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });
    if (!navigator.sendBeacon(this.getFullUrl(), body)) {
      log.warn("navigator.sendBeacon refused to send event payload:", payload);
    }
  }

  /** Create a GA4MP payload suitable for sending to the endpoint. */
  private buildPayload(
    time: number,
    events: EventT[],
  ): z.input<typeof AnyPayload> {
    return {
      client_id: this.clientId,
      timestamp_micros: time * 1000,
      user_properties: Object.fromEntries(
        [...this.userProperties].map(([k, v]) => [k, { value: v }]),
      ),
      events: events.map((e) => {
        const params: Record<
          string,
          number | string | Record<string, number | string>[]
        > = { ...e.params };

        if (e.items) {
          const items = e.items;
          params.items = items;
        }
        return { name: e.name, params: Object.fromEntries([]) };
      }),
    };
  }
}
