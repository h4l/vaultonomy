import debounce from "lodash.debounce";
import { Emitter, createNanoEvents } from "nanoevents";
import { z } from "zod";

import { log as _log } from "../logging";
import { AnyEvent, AnyPayload } from "./payload_schemas";

const log = _log.getLogger("ga4mp");

export type GA4MPClientOptions = {
  endpoint: string;
  measurementId: string;
  apiSecret: string;
  clientId: string;
  userProperties?: Params | Iterable<[string, string | number]>;
};

export type GA4MPClientCreateOptions = GA4MPClientOptions & {
  /** Whether to track user engagement time on each page. Default: true. */
  logEngagementTime?: boolean;
};

export type Params = Record<string, string | number>;

export interface GA4Event<
  NameT extends string = string,
  ParamsT extends Params = Params,
  ItemsT extends Params[] | undefined = Params[] | undefined,
> {
  name: NameT;
  params?: ParamsT;
  items?: ItemsT;
}

type EventGroup<EventT> = { time: number; events: EventT[] };

export type GA4MPClientEvents<EventT> = {
  event(event: EventT, time: number): void;
  /** Called when the client detects the page is entering an idle state or is closing.
   *
   * Immediately after this event has emitted, the client will flush queued
   * events to ensure they're sent before the page is closed.
   */
  becameIdle(): void;
  becameActive(): void;
  beforeDispose(): void;
};

/**
 * A client that sends events to a GA4 Measurement Protocol endpoint.
 *
 * Events are grouped together and sent in batches.
 */
export class GA4MPClient<EventT extends GA4Event = GA4Event> {
  readonly emitter: Emitter<GA4MPClientEvents<EventT>> = createNanoEvents();
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
  #isIdle: boolean | undefined = undefined;

  constructor(options: GA4MPClientOptions) {
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
  }

  static create(options: GA4MPClientCreateOptions): GA4MPClient {
    const client = new GA4MPClient(options);

    if (options.logEngagementTime ?? true) {
      new EngagementReporter(client);
    }

    new VisibilityStateIdleController(client);

    return client;
  }

  private clearLoggedEvents(): void {
    this.#loggedEventGroups = [];
    this.#loggedEventCount = 0;
  }

  becomeIdle(): void {
    if (this.#isIdle) return;
    this.#isIdle = true;

    // Give listeners a chance to log extra events before we flush events before
    // potential imminent termination (e.g. browser tab close).
    this.emitter.emit("becameIdle");

    // Flush the queue when our UI becomes hidden. This ensures the UI doesn't
    // get killed without sending events.
    this.#sendQueuedEventsSoon.flush();
  }

  becomeActive(): void {
    if (this.#isIdle === false) return;
    this.#isIdle = false;
    this.emitter.emit("becameIdle");
  }

  /** Record an event to be sent to the endpoint.
   *
   * The event will be grouped with other events that are close enough together
   * in time, and sent as a batch.
   */
  logEvent(...events: EventT[]) {
    const time = Date.now();

    for (const event of events) {
      log.debug("logEvent", event.name, event.params);
      this.emitter.emit("event", event, time);
    }

    this.#loggedEventGroups.push({ time, events });
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

  [Symbol.dispose]() {
    this.emitter.emit("beforeDispose");
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
        return { name: e.name, params };
      }),
    };
  }
}

/** Make a GA4MPClient idle/active according to `document.visibilityState`. */
class VisibilityStateIdleController {
  constructor(readonly client: GA4MPClient) {
    this.start();
  }

  #stop: (() => void) | undefined;
  /** Bind event listeners needed to operate. */
  private start() {
    if (this.#stop) return;

    const onVisibilityChange = () => {
      this.reportVisibilityState();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const stopBeforeDispose = this.client.emitter.on("beforeDispose", () => {
      this[Symbol.dispose]();
    });

    this.#stop = () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopBeforeDispose();
    };

    this.reportVisibilityState();
  }

  private reportVisibilityState(): void {
    if (document.visibilityState === "hidden") {
      this.client.becomeIdle();
    } else {
      this.client.becomeActive();
    }
  }

  [Symbol.dispose]() {
    this.#stop && this.#stop();
  }
}

/**
 * Track engagement time on pages.
 *
 * This detects and reports the time a page is visible for after a `page_load`
 * event. Events in `reportingEventNames` (just `scroll` by default) have a
 * `engagement_time_msec` parameter added to them. And when the page becomes
 * hidden, we send a `user_engagement` event, also with a `engagement_time_msec`
 * param, to log the accumulated engagement time since the last event that
 * reported `engagement_time_msec`.
 *
 * This implements Google Analytics web's engagement time reporting:
 * https://support.google.com/analytics/answer/9234069
 */
export class EngagementReporter {
  readonly minEngagementTime = 1000;

  private currentPageLoadTime: number | undefined;
  private currentPageParams: Params | undefined;
  private lastEngagementTime: number | undefined;

  readonly startingEventNames: ReadonlySet<string>;
  readonly reportingEventNames: ReadonlySet<string>;

  constructor(readonly client: GA4MPClient) {
    this.start();
    this.startingEventNames = new Set(["page_view"]);
    this.reportingEventNames = new Set(["scroll"]);
  }

  #stop: (() => void) | undefined;
  private start(): void {
    if (this.#stop) return;

    const stopOnEvent = this.client.emitter.on("event", (event, time) => {
      if (this.startingEventNames.has(event.name)) {
        this.startNewEngagementPeriod(event.params, time);
      }

      if (this.reportingEventNames.has(event.name)) {
        this.accumulateEngagementTimeInEvent(event);
      }
    });

    const stopBecameIdleEvent = this.client.emitter.on("becameIdle", () => {
      this.logAccumulatedEngagementTime();
    });

    const stopBecameActiveEvent = this.client.emitter.on("becameActive", () => {
      this.startNewEngagementPeriod(this.currentPageParams);
    });

    this.#stop = () => {
      stopOnEvent();
      stopBecameIdleEvent();
      stopBecameActiveEvent();
    };
  }

  getEngagementTimeSincePageLoad(now: number = Date.now()): number {
    return now - (this.currentPageLoadTime ?? now);
  }

  getEngagementTimeSinceLastReport(now: number = Date.now()): number {
    const loadTime = this.currentPageLoadTime ?? now;
    const lastEngagementTime = this.lastEngagementTime ?? loadTime;
    return now - lastEngagementTime;
  }

  accumulateEngagementTime(now: number = Date.now()): number {
    const engagementTime = this.getEngagementTimeSinceLastReport(now);

    if (engagementTime < 1) return 0;

    this.lastEngagementTime = now;
    return engagementTime;
  }

  startNewEngagementPeriod(
    pageParams: Params = this.getDefaultPageParams(),
    now: number = Date.now(),
  ): void {
    this.currentPageParams = { ...pageParams };
    this.currentPageLoadTime = now;
    this.lastEngagementTime = now;
  }

  logAccumulatedEngagementTime(now: number = Date.now()): void {
    const pageLoadTime = this.getEngagementTimeSincePageLoad(now);
    const engagementTime = this.getEngagementTimeSinceLastReport(now);

    const engagementLoggedSincePageLoad = this.lastEngagementTime === undefined;

    // We log engagement time less than the min if we had an engagement-logging
    // event within the min time. The min time is to avoid logging engagement
    // that is not significant, but the presence of an engagement event suggests
    // some engagement is happening.
    if (pageLoadTime < this.minEngagementTime && !engagementLoggedSincePageLoad)
      return;

    if (engagementTime < 1) return; // no point in logging 0 engagement time

    this.client.logEvent({
      // 'user_engagement' is a reserved event name, so we this alternative for
      // the same purpose.
      name: "user_engagementAccumulated",
      params: {
        ...this.currentPageParams,
        engagement_time_msec: engagementTime,
      },
    });
  }

  accumulateEngagementTimeInEvent(
    event: AnyEvent,
    now: number = Date.now(),
  ): void {
    const engagementTime = this.accumulateEngagementTime(now);

    if (engagementTime < 1) return;

    if (!event.params) event.params = {};
    event.params.engagement_time_msec = engagementTime;
  }

  private getDefaultPageParams(): Params {
    return {
      page_location: window.location.toString(),
      page_referrer: document.referrer,
    };
  }

  [Symbol.dispose]() {
    if (this.#stop) {
      this.#stop();
      this.#stop = undefined;
    }
  }
}
