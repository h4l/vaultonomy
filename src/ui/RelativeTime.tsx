import { DateTime } from "luxon";

import { useFormatDateTimeRelativeToNow } from "./utils/time";

export function RelativeTime({ when }: { when: number }): JSX.Element {
  const relative = useFormatDateTimeRelativeToNow(when);

  return (
    <time dateTime={DateTime.fromMillis(when).toISO() ?? undefined}>
      {relative}
    </time>
  );
}
