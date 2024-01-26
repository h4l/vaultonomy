import { DateTime } from "luxon";

export class TimeDependantTimeFormat {
  public readonly relFmt: Intl.RelativeTimeFormat;
  public readonly timeFmt: Intl.DateTimeFormat;
  public readonly dateTimeFmt: Intl.DateTimeFormat;
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
    this.dateTimeFmt = new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "medium",
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
    const deltaS = deltaMs / 1000;
    const deltaM = deltaMs / (1000 * 60);

    if (deltaS < 60)
      return this.relFmt.format(Math.floor(deltaS) * direction, "seconds");
    if (deltaM < 60)
      return this.relFmt.format(Math.floor(deltaM) * direction, "minutes");
    return this.timeFmt.format(date);
  }

  formatDateTimeAt(options: { when: number; now?: number }) {
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
    // Use a full date like 25 Sept 2025, 08:12:56
    return this.dateTimeFmt.format(date.toMillis());
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
export const formatDateTimeAt = (() => {
  const rtf = new TimeDependantTimeFormat();
  return rtf.formatDateTimeAt.bind(rtf);
})();
