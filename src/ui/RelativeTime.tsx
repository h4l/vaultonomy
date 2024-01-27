import { DateTime } from "luxon";
import { Children, ReactNode, useId } from "react";

import {
  formatAbsoluteDateTime,
  useFormatDateTimeRelativeToNow,
} from "./utils/time";

export function RelativeTime({ when }: { when: number }): JSX.Element {
  const relative = useFormatDateTimeRelativeToNow(when);

  return (
    <time dateTime={DateTime.fromMillis(when).toISO() ?? undefined}>
      <TextWithTooltip
        ttLabel="Full Date"
        ttText={formatAbsoluteDateTime({ when })}
      >
        {relative}
      </TextWithTooltip>
    </time>
  );
}

function TextWithTooltip({
  children,
  ttLabel,
  ttText,
}: {
  children?: ReactNode;
  ttLabel: string;
  ttText: string;
}): JSX.Element {
  const id = useId();
  return (
    <>
      {/* SR reads the title attribute, which is annoying, as it's intended to
          be optional/additional verbose detail. So only apply the title to the
          SR hidden version, and provide an accessible sr-only representation. */}
      <span className="sr-only">
        <span aria-describedby={id}>{children}</span>
        <span id={id} aria-label={ttLabel} role="tooltip">
          {ttText}
        </span>
      </span>
      <span aria-hidden="true" title={ttText}>
        {children}
      </span>
    </>
  );
}
