import { QueryClient, queryOptions, useQuery } from "@tanstack/react-query";

import { log } from "../../logging";
import type {
  RedditUserVault,
  GetRedditUserVaultQueryOptions as RpcQueryOptions,
} from "../../reddit/api-client";
import { RedditProvider } from "../../reddit/reddit-interaction-client";
import { RequiredNonNullable } from "../../types";
import { useRedditProvider } from "./useRedditProvider";

export type UseRedditUserVaultParameters = RpcQueryOptions;

export type GetRedditUserVaultQueryOptions = {
  query: UseRedditUserVaultParameters | undefined;
  redditProvider: RedditProvider | undefined;
};

function isEnabled(
  options: GetRedditUserVaultQueryOptions,
): options is RequiredNonNullable<GetRedditUserVaultQueryOptions> {
  return !!(options.redditProvider && options.query);
}

export function getRedditUserVaultQueryOptions(
  options: GetRedditUserVaultQueryOptions,
) {
  return queryOptions({
    queryKey: ["RedditProvider", "UserVault", options.query?.userId],
    async queryFn(): Promise<RedditUserVault | null> {
      if (!isEnabled(options)) throw new Error("not enabled");
      const { redditProvider, query } = options;
      return await redditProvider.getUserVault({ query });
    },
    enabled: isEnabled(options),
  });
}

export function useRedditUserVault({
  query,
}: {
  query: UseRedditUserVaultParameters | undefined;
}) {
  const { redditProvider } = useRedditProvider();

  const fullOptions = {
    redditProvider: redditProvider ?? undefined,
    query,
  };
  return useQuery({
    ...getRedditUserVaultQueryOptions(fullOptions),
  });
}

export async function prefetchRedditUserVault({
  queryClient,
  ...options
}: {
  queryClient: QueryClient;
} & RequiredNonNullable<GetRedditUserVaultQueryOptions>): Promise<void> {
  log.debug("prefetchRedditUserVault", options.query);
  await queryClient.prefetchQuery(getRedditUserVaultQueryOptions(options));
}
