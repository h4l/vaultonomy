import { log } from "../logging";

/**
 * Wrap an async function to register it as an event callback.
 *
 * If the async function rejects, the error is logged and ignored.
 */
export function handleAsync<T extends any[]>(
  handler: (...args: T) => Promise<void>,
): (...args: T) => void {
  return (...args: T) => {
    handler(...args).catch(log.error);
  };
}
