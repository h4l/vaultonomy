import { inspect } from "util";

export class AssertionError extends Error {}

export function assert(
  assertion: unknown,
  message?: string
): asserts assertion {
  if (!assertion) throw new AssertionError(message ?? "assertion failed");
}

export function assertUnreachable(x: never): never {
  assert(false, `assertUnreachable was called with ${inspect(x)}`);
}
