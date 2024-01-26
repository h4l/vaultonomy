import { jest } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import { DateTime } from "luxon";

import { RelativeTime } from "../RelativeTime";

describe("RelativeTime", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });
  test("relative times change as time passes", async () => {
    const when = DateTime.fromISO("2024-01-26T08:14:13");
    const start = DateTime.fromISO("2024-01-26T08:14:13.123Z");

    jest.setSystemTime(start.toMillis());
    render(
      <span data-testid="time">
        <RelativeTime when={when.toMillis()}></RelativeTime>
      </span>,
    );

    expect(await screen.getByTestId("time")).toHaveTextContent("now");
    await act(async () => await jest.advanceTimersByTimeAsync(1000 * 3));
    expect(await screen.getByTestId("time")).toHaveTextContent("3 seconds ago");
    await act(async () => await jest.advanceTimersByTimeAsync(1000 * 60));
    expect(await screen.getByTestId("time")).toHaveTextContent("1 minute ago");
  });
});
