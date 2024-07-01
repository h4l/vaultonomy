import { DateTime } from "luxon";
import { createNanoEvents } from "nanoevents";
import { useEffect, useState } from "react";

import { assert } from "../../assert";

export class TimeDependantTimeFormat {
  public readonly relFmt: Intl.RelativeTimeFormat;
  public readonly timeFmt: Intl.DateTimeFormat;
  public readonly dateTimeFmtAbs: Intl.DateTimeFormat;
  public readonly dateFmt: Intl.DateTimeFormat;
  public readonly listFmt: Intl.ListFormat;
  public readonly timeZone?: string;

  constructor(options: { locale?: string; timeZone?: string } = {}) {
    const { locale, timeZone } = options;

    this.timeZone = timeZone;
    this.relFmt = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    this.timeFmt = new Intl.DateTimeFormat(locale, {
      timeStyle: "medium",
      timeZone,
    });
    this.dateTimeFmtAbs = new Intl.DateTimeFormat(locale, {
      dateStyle: "long",
      timeStyle: "long",
      timeZone,
    });
    this.dateFmt = new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone,
    });
    this.listFmt = new Intl.ListFormat(locale, {
      type: "unit",
      style: "long",
    });
  }

  private formatTimeAt(options: { date: number; now?: number }) {
    const { date, now = Date.now() } = options;

    const direction = date < now ? -1 : 1;
    const deltaMs = Math.abs(now - date);
    const deltaS = deltaMs / SECOND;
    const deltaM = deltaMs / MINUTE;

    if (deltaS < 60)
      return this.relFmt.format(Math.floor(deltaS) * direction, "seconds");
    if (deltaM < 60)
      return this.relFmt.format(Math.floor(deltaM) * direction, "minutes");
    return this.timeFmt.format(date);
  }

  formatDateTimeAt(options: { when: number; now?: number }): string {
    // timezone doesn't matter for our relative time calculations, but does for
    // determining calendar date.
    const date = DateTime.fromMillis(options.when).setZone(this.timeZone);
    const now = DateTime.fromMillis(options.now ?? Date.now()).setZone(
      this.timeZone,
    );
    const thenDate = floorDate(date);
    const nowDate = floorDate(now);

    // Use relative time even if it goes across midnight
    if (Math.abs(now.diff(date, "hours").hours) <= 1) {
      return this.formatTimeAt({ date: date.toMillis(), now: now.toMillis() });
    }

    const deltaCalendarDays = Math.round(thenDate.diff(nowDate, "days").days);
    if (Math.abs(deltaCalendarDays) <= 1) {
      // Use a combo like yesterday, 7:34:01
      const day = this.relFmt.format(deltaCalendarDays, "days");
      const time = this.timeFmt.format(date.toMillis());
      return this.listFmt.format([day, time]);
    }
    // Use a full date like 25 Sept 2025
    return this.dateFmt.format(date.toMillis());
  }

  formatAbsoluteDateTime(options: { when: number }): string {
    return this.dateTimeFmtAbs.format(options.when);
  }
}

function floorDate(dt: DateTime): DateTime {
  return dt.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
}

/**
 * Format a date-time from the point-of-view of the current (`now`) time.
 *
 * The time can be displayed as a relative value (5 minutes ago) when close, or
 * with a relative date (yesterday, 07:55:21). Dates further away just use
 * normal full date-time format.
 *
 * All values use Intl.* locale-aware formatting, so they should make sense in
 * the user/browser's current locale.
 */
export const { formatDateTimeAt, formatAbsoluteDateTime } = (() => {
  const rtf = new TimeDependantTimeFormat();
  return {
    formatDateTimeAt: rtf.formatDateTimeAt.bind(rtf),
    formatAbsoluteDateTime: rtf.formatAbsoluteDateTime.bind(rtf),
  };
})();

const SECOND = 1000;
const MINUTE = SECOND * 60;

type Callback = () => void;
type Stop = () => void;
type TickerName = "everySecond" | "everyMinute";
type Ticker = { rate: number; stop?: Stop };

const tickers: Record<TickerName, Ticker> = {
  everySecond: { rate: SECOND },
  everyMinute: { rate: MINUTE },
} as const;

const tickerEvents = createNanoEvents<{
  everySecond: () => void;
  everyMinute: () => void;
  subscribersChanged: () => void;
}>();

function tickAtRate({
  onTick,
  tickRate,
}: {
  onTick: () => void;
  tickRate: number;
}): () => void {
  assert(tickRate > 0);
  const now = Date.now();
  const firstTick = Math.ceil(now / tickRate) * tickRate;

  let t2: NodeJS.Timeout | undefined;
  const t1 = setTimeout(() => {
    onTick();
    t2 = setInterval(onTick, tickRate);
  }, firstTick - now);

  return () => {
    if (t2) clearInterval(t2);
    else clearTimeout(t1);
  };
}

function startStopTicker(name: TickerName): void {
  const subCount = tickerEvents.events[name]?.length ?? 0;
  const ticker = tickers[name];
  if (subCount === 0 && ticker.stop) {
    ticker.stop();
    ticker.stop = undefined;
  } else if (subCount > 0 && !ticker.stop) {
    const onTick = () => tickerEvents.emit(name);
    ticker.stop = tickAtRate({ onTick, tickRate: ticker.rate });
  }
}

tickerEvents.on("subscribersChanged", () => {
  startStopTicker("everySecond");
  startStopTicker("everyMinute");
});

type TickerSubscribeFn = (onTick: Callback) => Stop;
const createTickerSubscribeFn = (
  freq: "everySecond" | "everyMinute",
): TickerSubscribeFn => {
  return (onTick: Callback): Stop => {
    const stop = tickerEvents.on(freq, onTick);
    tickerEvents.emit("subscribersChanged");
    return () => {
      stop();
      tickerEvents.emit("subscribersChanged");
    };
  };
};

const everySecond = createTickerSubscribeFn("everySecond");
const everyMinute = createTickerSubscribeFn("everyMinute");

const getTicker = (when: number) => {
  const now = Date.now();

  if (when - MINUTE <= now && when + MINUTE >= now) {
    return { run: everySecond, until: when + MINUTE + SECOND };
  }
  return { run: everyMinute, until: undefined };
};

/**
 * Subscribe to a human-readable representation of the `when` timestamp.
 *
 * The timestamp is formatted with `formatDateTimeAt()` — relative when close to
 * the current time.
 */
export function useFormatDateTimeRelativeToNow(
  when: number | undefined,
): string | undefined {
  // This implementation updates every second when the time is within 1 minute
  // of when, then every 1 minute otherwise. We could stop updating at the 1h
  // boundary until next midnight, but I don't think it's worth implementing.
  // Multiple subscribers share the same 1s and 1m ticker to avoid creating
  // timers per use* call.

  let stopSubscribeToTickers: () => void;
  const subscribeToTickers = (onTick: () => void): (() => void) => {
    if (when === undefined) return () => {};

    const now = Date.now();
    const ticker = getTicker(when);

    if (ticker.until !== undefined) {
      assert(ticker?.until >= now);

      // Run until `until` is reached, then resubscribe
      const cancelRun = ticker.run(onTick);
      const runEnd = setTimeout(() => {
        cancelRun();
        subscribeToTickers(onTick);
      }, ticker.until - now);

      stopSubscribeToTickers = () => {
        cancelRun();
        clearTimeout(runEnd);
      };
    } else {
      // Run until cancelled
      stopSubscribeToTickers = ticker.run(onTick);
    }

    return () => {
      stopSubscribeToTickers();
    };
  };

  const [whenRelativeToNow, setWhenRelativeToNow] = useState(() =>
    when === undefined ? undefined : formatDateTimeAt({ when }),
  );

  useEffect(() => {
    if (when === undefined) return;
    return subscribeToTickers(() => {
      setWhenRelativeToNow(formatDateTimeAt({ when }));
    });
  }, [when]);

  return whenRelativeToNow;
}
