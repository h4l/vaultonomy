import { expect, jest } from "@jest/globals";

import { subscriptionValues } from "../subscriptionValues";

const nextTick = async () =>
  new Promise((resolve) => process.nextTick(resolve));

describe("subscriptionValues", () => {
  test("generates values provided to subscriber", async () => {
    const valuesSeen: number[] = [];
    const unsubscribe = jest.fn();

    for await (const value of subscriptionValues<number>((subscriber) => {
      // synchronous, before subscriptionValues() returns
      subscriber(0);
      subscriber(1);

      // async
      let unsubscribed = false;
      unsubscribe.mockImplementationOnce(() => {
        unsubscribed = true;
      });

      (async () => {
        for (let i = 2; !unsubscribed; ++i) {
          subscriber(i);
          await nextTick();
        }
      })();

      return unsubscribe;
    })) {
      valuesSeen.push(value);
      if (value === 3) break;
    }

    expect(valuesSeen).toEqual([0, 1, 2, 3]);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
