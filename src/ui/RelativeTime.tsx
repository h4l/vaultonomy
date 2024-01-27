import { DateTime } from "luxon";

import {
  formatAbsoluteDateTime,
  useFormatDateTimeRelativeToNow,
} from "./utils/time";

export function RelativeTime({ when }: { when: number }): JSX.Element {
  const relative = useFormatDateTimeRelativeToNow(when);

  return (
    <time
      title={formatAbsoluteDateTime({ when })}
      dateTime={DateTime.fromMillis(when).toISO() ?? undefined}
    >
      {relative}
    </time>
  );
}
