import {
  QueryClient,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Address, getAddress, isAddress } from "viem";
import { normalize } from "viem/ens";
import { Config, useConfig, useEnsText } from "wagmi";
import { getEnsAddressQueryOptions, getEnsTextQueryOptions } from "wagmi/query";

import { assert, assertUnreachable } from "../../assert";
import { log } from "../../logging";
import {
  RedditProvider,
  RedditProviderError,
} from "../../reddit/reddit-interaction-client";
import { ErrorCode } from "../../reddit/reddit-interaction-spec";
import { RequiredNonNullable } from "../../types";
import { Result } from "../state/createVaultonomyStore";
import { useVaultonomyStore } from "../state/useVaultonomyStore";
import { useRedditProvider } from "./useRedditProvider";
import { getRedditUserProfileQueryOptions } from "./useRedditUserProfile";
import { getRedditUserVaultQueryOptions } from "./useRedditUserVault";

export type SearchForUserVariables = {
  rawQuery: string;
};

type UsernameQuery = { type: "username"; username: string };
type AddressQuery = { type: "address"; address: Address };
type EnsNameQuery = { type: "ensName"; ensName: string };

type ValidParsedQuery = UsernameQuery | AddressQuery | EnsNameQuery;
type InvalidParsedQuery = {
  type: "invalid-query";
  reason:
    | "address-checksum"
    | "address"
    | "empty"
    | "multiple"
    | "username"
    | "username-length"
    | "ens-name";
};
export type ParsedQuery = ValidParsedQuery | InvalidParsedQuery;

type SearchForUserError =
  | InvalidParsedQuery
  | { type: "not-found"; query: ValidParsedQuery }
  | { type: "internal-error" };
type SearchForUser = { username: string };
export type SearchForUserResult = Result<SearchForUser, SearchForUserError>;

type GetSearchForUserQueryOptions = {
  rawQuery: string;
  session: { userId: string } | undefined;
  redditProvider: RedditProvider | null | undefined;
  queryClient: QueryClient;
  wagmiConfig: Config;
};

type SearchForUserOptions = RequiredNonNullable<
  Omit<GetSearchForUserQueryOptions, "rawQuery">
>;

export function parseQuery(rawQuery: string): ParsedQuery {
  const query = rawQuery.trim();
  if (!query) {
    return { type: "invalid-query", reason: "empty" };
  }
  if (/\s/.test(query)) {
    return { type: "invalid-query", reason: "multiple" };
  }
  // Address-like strings <= 20 chars are valid usernames, so require at least
  // 21 chars before considering it an address.
  if (query.length > 20 && /^0[xX]/.test(query)) {
    if (isAddress(query))
      return { type: "address", address: getAddress(query) };
    if (isAddress(query.toLowerCase())) {
      return { type: "invalid-query", reason: "address-checksum" };
    }
    return { type: "invalid-query", reason: "address" };
  }

  // Usernames can't contain ".". Treat anything like x.y as an ENS name — ENS
  // names don't have to be .ens subdomains.
  if (/^[\S]+\.[\S]+$/.test(query)) {
    // normalize throws when the ENS name is invalid
    try {
      return { type: "ensName", ensName: normalize(query) };
    } catch (e) {
      return { type: "invalid-query", reason: "ens-name" };
    }
  }

  if (/^[\w-]+$/.test(query)) {
    if (query.length > 20) {
      return { type: "invalid-query", reason: "username-length" };
    }
    return { type: "username", username: query.toLowerCase() };
  }

  return { type: "invalid-query", reason: "username" };
}

function getParsedQueryKey(parsedQuery: ParsedQuery): string {
  switch (parsedQuery.type) {
    case "address": {
      return `address:${parsedQuery.address}`;
    }
    case "ensName": {
      return `ensName:${parsedQuery.ensName}`;
    }
    case "username": {
      return `username:${parsedQuery.username}`;
    }
    case "invalid-query": {
      return `invalid-query:${parsedQuery.reason}:${parsedQuery.query}`;
    }
  }
}

async function searchForUser({
  rawQuery,
  ...options
}: { rawQuery: string } & SearchForUserOptions): Promise<SearchForUserResult> {
  const query = parseQuery(rawQuery);
  if (query.type === "invalid-query") return { result: "error", error: query };

  switch (query.type) {
    case "username": {
      return await searchForUserByUsername({ query, ...options });
    }
    case "address": {
      return await searchForUserByVaultAddress({ query, ...options });
    }
    case "ensName": {
      return await searchForUserByEnsName({ query, ...options });
    }
  }
  assertUnreachable(query);
}

// TODO: normalise username in ENS text, e.g. allow u/foo or https://reddit.com/u/foo

async function searchForUserByUsername({
  query,
  session,
  redditProvider,
  queryClient,
}: {
  query: UsernameQuery;
} & Pick<
  SearchForUserOptions,
  "session" | "redditProvider" | "queryClient"
>): Promise<SearchForUserResult> {
  try {
    const result = await queryClient.fetchQuery(
      getRedditUserProfileQueryOptions({
        redditProvider,
        session,
        username: query.username,
      }),
    );
    return { result: "ok", value: { username: result.username } };
  } catch (e) {
    if (e instanceof RedditProviderError && e.type === ErrorCode.NOT_FOUND) {
      return { result: "error", error: { type: "not-found", query } };
    }
    throw e;
  }
}

async function searchForUserByVaultAddress({
  query,
  redditProvider,
  queryClient,
}: {
  query: AddressQuery;
} & Pick<
  SearchForUserOptions,
  "redditProvider" | "queryClient"
>): Promise<SearchForUserResult> {
  const result = await queryClient.fetchQuery(
    getRedditUserVaultQueryOptions({
      redditProvider,
      query: { type: "address", value: query.address },
    }),
  );
  if (!result) return { result: "error", error: { type: "not-found", query } };
  return { result: "ok", value: { username: result.username } };
}

async function searchForUserByEnsName({
  ...options
}: {
  query: EnsNameQuery;
} & SearchForUserOptions) {
  const [byAddress, byTxtRecord] = await Promise.all([
    searchForUserByEnsNameAddress(options),
    searchForUserByEnsNameTxtRecord(options),
  ]);
  // Prefer resolving by vault address match, as this has a cryptographic chain,
  // whereas anyone can create a com.reddit txt record.
  if (byAddress.result === "ok") return byAddress;
  if (byTxtRecord.result === "ok") return byTxtRecord;

  assert(byAddress.error.type === "not-found");
  return byAddress;
}

async function searchForUserByEnsNameAddress({
  query,
  queryClient,
  wagmiConfig,
  ...options
}: {
  query: EnsNameQuery;
} & SearchForUserOptions): Promise<SearchForUserResult> {
  const address = await queryClient.fetchQuery(
    getEnsAddressQueryOptions(wagmiConfig, {
      name: normalize(query.ensName),
    }),
  );
  if (!address) return { result: "error", error: { type: "not-found", query } };
  return await searchForUserByVaultAddress({
    query: { type: "address", address },
    queryClient,
    ...options,
  });
}

async function searchForUserByEnsNameTxtRecord({
  query,
  session,
  redditProvider,
  queryClient,
  wagmiConfig,
}: {
  query: EnsNameQuery;
} & SearchForUserOptions): Promise<SearchForUserResult> {
  const result = await queryClient.fetchQuery(
    getEnsTextQueryOptions(wagmiConfig, {
      name: normalize(query.ensName),
      key: "com.reddit",
    }),
  );
  const validated = parseQuery(result?.trim() ?? "");
  if (validated.type === "username") {
    return await searchForUserByUsername({
      query: validated,
      queryClient,
      redditProvider,
      session,
    });
  }
  return { result: "error", error: { type: "not-found", query } };
}

function isEnabled(
  options: GetSearchForUserQueryOptions,
): options is RequiredNonNullable<GetSearchForUserQueryOptions> {
  return !!(options.redditProvider && options.session && options.session);
}

export function getSearchForUserQueryOptions(
  options: GetSearchForUserQueryOptions,
) {
  return queryOptions({
    // use the parsed query in the key to normalise the query so that we serve
    // equivalent queries from the cache.
    queryKey: ["SearchForUser", parseQuery(options.rawQuery)],
    async queryFn() {
      if (!isEnabled(options)) throw new Error("not enabled");
      return await searchForUser(options);
    },
    enabled: isEnabled(options),
  });
}

export function useDoSearchForUser() {
  const queryClient = useQueryClient();
  const wagmiConfig = useConfig();
  const [currentUserId, setSearchForUserQuery, setSearchForUserResult] =
    useVaultonomyStore((s) => [
      s.currentUserId,
      s.setSearchForUserQuery,
      s.setSearchForUserResult,
    ]);
  const { redditProvider } = useRedditProvider();

  const baseQueryOptions: GetSearchForUserQueryOptions = {
    rawQuery: "",
    queryClient,
    redditProvider,
    session: currentUserId ? { userId: currentUserId } : undefined,
    wagmiConfig,
  };
  const _isEnabled = isEnabled(baseQueryOptions);
  return {
    isEnabled: _isEnabled,
    ...useMutation({
      mutationFn: async ({ rawQuery }: SearchForUserVariables) => {
        if (!_isEnabled) throw new Error("mutate called while !isEnabled");

        const queryKey = getParsedQueryKey(parseQuery(rawQuery));
        setSearchForUserQuery({ queryKey, rawQuery });

        const queryOptions = getSearchForUserQueryOptions({
          ...baseQueryOptions,
          rawQuery,
        });

        return { queryKey, result: await queryClient.fetchQuery(queryOptions) };
      },

      onSuccess: ({ queryKey, result }) => {
        setSearchForUserResult({ queryKey, result });
      },

      onError: (error: unknown, { rawQuery }) => {
        log.error(
          "SearchForUser failed; rawQuery:",
          rawQuery,
          ", error:",
          error,
        );

        const queryKey = getParsedQueryKey(parseQuery(rawQuery));

        setSearchForUserResult({
          queryKey,
          result: {
            result: "error",
            error: { type: "internal-error" },
          },
        });
      },
    }),
  };
}
