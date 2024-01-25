import { useRedditProvider } from "./useRedditProvider";

/** `true` when we have an active connection to a Reddit tab. */
export function useIsRedditAvailable(): boolean {
  return useRedditProvider().isAvailable;
}
