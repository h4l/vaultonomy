import { assert } from "../assert";

/**
 * A fixed-length queue that throws away the oldest entry when capacity is reached.
 */
export class Queue<T> {
  readonly maxSize: number;
  #values: Array<T>;
  constructor({ maxSize }: { maxSize: number }) {
    if (!(maxSize >= 1)) throw new Error("invalid maxSize");
    this.maxSize = maxSize;
    this.#values = [];
  }

  get values(): ReadonlyArray<T> {
    return this.#values;
  }

  private ensureCapacity(count: number): void {
    assert(count >= 0);
    const sizeAfter = this.#values.length + count;
    const overflow = sizeAfter - this.maxSize;
    this.#values.splice(0, overflow);
  }

  push(item: T): void {
    this.ensureCapacity(1);
    this.#values.push(item);
    assert(this.#values.length <= this.maxSize);
  }

  popWhile(predicate: (item: T, index: number) => boolean): T[] {
    let i = 0;
    for (; i < this.#values.length; ++i) {
      if (!predicate(this.#values[i], i)) break;
    }
    return this.#values.splice(0, i);
  }
}
