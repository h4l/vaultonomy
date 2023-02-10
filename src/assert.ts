export class AssertionError extends Error {}

export function assert(
  assertion: unknown,
  message?: string
): asserts assertion {
  if (!assertion) throw new AssertionError(message ?? "assertion failed");
}
