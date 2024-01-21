import { VaultonomyError } from "./VaultonomyError";
import { assert } from "./assert";

export class Timeout<T> extends VaultonomyError {
  readonly timeout: true = true;

  constructor(
    readonly limit: number,
    readonly label: string | undefined,
    readonly pendingValue: Promise<T>,
  ) {
    super(`${label ? `${label} ` : ""}timed out after ${limit}ms`);
  }
}

export class NoTimeout<T> {
  readonly timeout: false = false;
  constructor(
    readonly limit: number,
    readonly label: string | undefined,
    readonly value: T,
  ) {}
}

const TIMEOUT = Symbol("timeout");

export type TimeoutResult<T> = NoTimeout<T> | Timeout<T>;

export async function withTimeout<T>(
  limit: number,
  pendingValue: Promise<T>,
): Promise<TimeoutResult<T>>;
export async function withTimeout<T>(
  limit: number,
  label: string | undefined,
  pendingValue: Promise<T>,
): Promise<TimeoutResult<T>>;
export async function withTimeout<T>(
  limit: number,
  _label: string | undefined | Promise<T>,
  _pendingValue?: Promise<T>,
): Promise<TimeoutResult<T>> {
  let label: string | undefined;
  let pendingValue: Promise<T>;
  if (_pendingValue === undefined) {
    assert(_label !== undefined && typeof _label !== "string");
    pendingValue = _label;
  } else {
    assert(_pendingValue !== undefined && typeof _label !== "object");
    label = _label;
    pendingValue = _pendingValue;
  }
  const result = await Promise.race([
    pendingValue,
    new Promise<typeof TIMEOUT>((resolve) =>
      setTimeout(() => resolve(TIMEOUT), limit),
    ),
  ]);
  if (result === TIMEOUT) return new Timeout<T>(limit, label, pendingValue);
  return new NoTimeout(limit, label, result);
}

export async function withRejectOnTimeout<T>(
  limit: number,
  label: string | undefined,
  pendingValue: Promise<T>,
): Promise<T> {
  const result = await withTimeout(limit, label, pendingValue);
  if (result.timeout) throw result;
  return result.value;
}
