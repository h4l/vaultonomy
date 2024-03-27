import { VaultonomyError } from "../../VaultonomyError";
import { assert } from "../../assert";
import { RedditProvider } from "../../reddit/reddit-interaction-client";
import { useVaultonomyStoreSingle } from "../state/useVaultonomyStore";
import { useRedditTabAvailability } from "./useRedditTabAvailability";

export class RedditNotConnectedError extends VaultonomyError {}

type UseRedditProviderResult =
  | { isAvailable: true; redditProvider: RedditProvider }
  | { isAvailable: false; redditProvider: null };

export function useRedditProvider(): UseRedditProviderResult {
  const redditTabAvailability = useRedditTabAvailability();
  const provider = useVaultonomyStoreSingle((s) => s.provider);

  if (redditTabAvailability.data?.available) {
    assert(provider, "provider not set in store");
    return { isAvailable: true, redditProvider: provider.redditProvider };
  }
  return { isAvailable: false, redditProvider: null };
}

export function assumeAvailable(
  redditProvider: RedditProvider | null | undefined,
): RedditProvider {
  if (!redditProvider) throw new RedditNotConnectedError();
  return redditProvider;
}
