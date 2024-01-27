import { DateTime } from "luxon";

import {
  TimeDependantTimeFormat,
  formatAbsoluteDateTime,
  formatDateTimeAt,
} from "../time";

function parse(isoDateTime: string, timeZone?: string): DateTime {
  return DateTime.fromISO(isoDateTime, { zone: timeZone });
}

// Not sure that the Arabic "today, 07:13:21" is correct. Translates as
// "today and 07:13:21 AM", despite using the unit list format. 🤷 If it is
// wrong I think it's a bug in Intl.ListFormat.
test.each`
  now                      | when                     | expected                 | locale     | timeZone
  ${"2024-06-25T08:19:34"} | ${"2024-06-25T08:19:34"} | ${"now"}                 | ${"en-GB"} | ${"Europe/London"}
  ${"2024-06-25T08:19:34"} | ${"2024-06-25T08:19:00"} | ${"34 seconds ago"}      | ${"en-GB"} | ${"Europe/London"}
  ${"2024-06-25T08:19:34"} | ${"2024-06-25T08:19:45"} | ${"in 11 seconds"}       | ${"en-GB"} | ${"Europe/London"}
  ${"2024-06-25T08:19:34"} | ${"2024-06-25T08:13:21"} | ${"6 minutes ago"}       | ${"en-GB"} | ${"Europe/London"}
  ${"2024-06-25T00:19:34"} | ${"2024-06-24T23:53:21"} | ${"26 minutes ago"}      | ${"en-GB"} | ${"Europe/London"}
  ${"2024-06-25T08:19:34"} | ${"2024-06-25T08:34:21"} | ${"in 14 minutes"}       | ${"en-GB"} | ${"Europe/London"}
  ${"2024-06-25T08:19:34"} | ${"2024-06-25T07:13:21"} | ${"today, 07:13:21"}     | ${"en-GB"} | ${"Europe/London"}
  ${"2024-06-25T08:19:34"} | ${"2024-06-25T14:13:21"} | ${"today, 14:13:21"}     | ${"en-GB"} | ${"Europe/London"}
  ${"2024-06-25T08:19:34"} | ${"2024-06-24T16:13:21"} | ${"yesterday, 16:13:21"} | ${"en-GB"} | ${"Europe/London"}
  ${"2024-06-25T08:19:34"} | ${"2023-06-25T10:12:56"} | ${"25 Jun 2023"}         | ${"en-GB"} | ${"Europe/London"}
  ${"2024-06-25T08:19:34"} | ${"2025-06-25T10:12:56"} | ${"25 Jun 2025"}         | ${"en-GB"} | ${"Europe/London"}
  ${"2024-06-25T08:19:34"} | ${"2024-06-25T08:19:34"} | ${"nyt"}                 | ${"fi"}    | ${"Europe/Helsinki"}
  ${"2024-06-25T08:19:34"} | ${"2024-06-25T08:19:00"} | ${"34 sekuntia sitten"}  | ${"fi"}    | ${"Europe/Helsinki"}
  ${"2024-06-25T08:19:34"} | ${"2024-06-25T08:19:45"} | ${"11秒钟后"}            | ${"zh-CN"} | ${"CST"}
  ${"2024-06-25T08:19:34"} | ${"2024-06-25T08:13:21"} | ${"ከ6 ደቂቃዎች በፊት"}        | ${"am-ET"} | ${"Africa/Addis_Ababa"}
  ${"2024-06-25T08:19:34"} | ${"2024-06-25T08:34:21"} | ${"በ14 ደቂቃዎች ውስጥ"}       | ${"am-ET"} | ${"Africa/Addis_Ababa"}
  ${"2024-06-25T08:19:34"} | ${"2024-06-25T07:13:21"} | ${"اليوم و٧:١٣:٢١ ص"}    | ${"ar"}    | ${"Asia/Beirut"}
  ${"2024-06-25T08:19:34"} | ${"2024-06-25T14:13:21"} | ${"今天14:13:21"}        | ${"zh-CN"} | ${"CST"}
  ${"2024-06-25T08:19:34"} | ${"2024-06-24T16:13:21"} | ${"ትናንት፣ 4:13:21 ከሰዓት"}  | ${"am-ET"} | ${"Africa/Addis_Ababa"}
  ${"2024-06-25T08:19:34"} | ${"2023-06-25T10:12:56"} | ${"٢٥‏/٠٦‏/٢٠٢٣"}        | ${"ar"}    | ${"Asia/Beirut"}
  ${"2024-06-25T08:19:34"} | ${"2025-06-25T10:12:56"} | ${"2025年6月25日"}       | ${"zh-CN"} | ${"CST"}
`(
  "formatDateTimeAt — $now - $date = $expected",
  (options: {
    now: string;
    when: string;
    expected: string;
    locale: string;
    timeZone: string;
  }) => {
    const tf = new TimeDependantTimeFormat({
      locale: options.locale,
      timeZone: options.timeZone,
    });
    const now = parse(options.now, options.timeZone);
    const when = parse(options.when, options.timeZone);

    expect(
      tf.formatDateTimeAt({ when: when.toMillis(), now: now.toMillis() }),
    ).toEqual(options.expected);
  },
);

test.each`
  when                     | expected                                  | locale     | timeZone
  ${"2025-06-25T10:12:56"} | ${"25 June 2025 at 10:12:56 BST"}         | ${"en-GB"} | ${"Europe/London"}
  ${"2024-06-25T08:19:34"} | ${"25. kesäkuuta 2024 klo 8.19.34 UTC+3"} | ${"fi"}    | ${"Europe/Helsinki"}
  ${"2024-06-25T08:19:45"} | ${"2024年6月25日 GMT-5 08:19:45"}         | ${"zh-CN"} | ${"CST"}
`(
  "formatAbsoluteDateTime formats a full date",
  (options: {
    when: string;
    expected: string;
    locale: string;
    timeZone: string;
  }) => {
    const tf = new TimeDependantTimeFormat({
      locale: options.locale,
      timeZone: options.timeZone,
    });
    const when = parse(options.when, options.timeZone);

    expect(tf.formatAbsoluteDateTime({ when: when.toMillis() })).toEqual(
      options.expected,
    );
  },
);

test("module formatDateTimeAt export uses default locale", () => {
  const defaultTf = new TimeDependantTimeFormat();

  const now = parse("2024-06-25T08:19:34").toMillis();
  const when = parse("2024-06-24T16:13:21").toMillis();

  expect(formatDateTimeAt({ now, when })).toEqual(
    defaultTf.formatDateTimeAt({ now, when }),
  );
});

test("module formatAbsoluteDateTime export uses default locale", () => {
  const defaultTf = new TimeDependantTimeFormat();

  const when = parse("2024-06-24T16:13:21").toMillis();

  expect(formatAbsoluteDateTime({ when })).toEqual(
    defaultTf.formatAbsoluteDateTime({ when }),
  );
});
