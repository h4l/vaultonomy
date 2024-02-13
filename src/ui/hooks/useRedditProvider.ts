import { VaultonomyError } from "../../VaultonomyError";
import { RedditProvider } from "../../reddit/reddit-interaction-client";
import { useVaultonomyStore } from "../state/useVaultonomyStore";

export class RedditNotConnectedError extends VaultonomyError {}

type UseRedditProviderResult =
  | { isAvailable: true; redditProvider: RedditProvider }
  | { isAvailable: false; redditProvider: null };

export function useRedditProvider(): UseRedditProviderResult {
  const redditProvider = useVaultonomyStore((s) => s.redditProvider);

  if (redditProvider) return { isAvailable: true, redditProvider };
  return { isAvailable: false, redditProvider: null };
}

export function assumeAvailable(
  redditProvider: RedditProvider | null,
): RedditProvider {
  if (!redditProvider) throw new RedditNotConnectedError();
  return redditProvider;
}
