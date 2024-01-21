import { VaultonomyError } from "./VaultonomyError";

export class AssertionError extends VaultonomyError {}

export function assert(
  assertion: unknown,
  message?: string,
): asserts assertion {
  if (!assertion) throw new AssertionError(message ?? "assertion failed");
}

export function assertUnreachable(x: never): never {
  assert(false, `assertUnreachable was called with ${JSON.stringify(x)}`);
}
