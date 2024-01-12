type Unsubscribe = () => void;

/**
 * Get an AsyncGenerator that yields values sent asynchronously to a function.
 *
 * @param subscribe A function that will be called synchronously to subscribe
 * the generator to the value provider.
 */
export async function* subscriptionValues<T>(
  subscribe: (subscriber: (value: T) => void) => Unsubscribe | void,
): AsyncGenerator<T> {
  const queue: T[] = [];
  let queueNonEmpty: () => void = () => {};
  const unsubscribe = subscribe((value) => {
    queue.push(value);
    queueNonEmpty();
  });
  try {
    while (true) {
      while (queue.length) {
        yield queue.splice(0, 1)[0];
      }
      await new Promise<void>((resolve) => {
        queueNonEmpty = resolve;
      });
    }
  } finally {
    if (unsubscribe) unsubscribe();
  }
}
