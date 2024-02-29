import {
  QueryClient,
  QueryKey,
  queryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Address, getAddress, isAddress } from "viem";
import { normalize } from "viem/ens";
import { Config, useConfig } from "wagmi";
import { getEnsAddressQueryOptions, getEnsTextQueryOptions } from "wagmi/query";

import { assert, assertUnreachable } from "../../assert";
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

export type UseSearchForUserOptions = {
  query: ValidParsedQuery | undefined;
  initialDataUsername?: string | undefined;
};

type UsernameQuery = { type: "username"; value: string };
type AddressQuery = { type: "address"; value: Address };
type EnsNameQuery = { type: "ens-name"; value: string };

export type ValidParsedQuery = UsernameQuery | AddressQuery | EnsNameQuery;
export type InvalidParsedQuery = {
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

type SearchForUserError = { type: "not-found"; query: ValidParsedQuery };
type SearchForUser = { username: string };
export type SearchForUserResult = Result<SearchForUser, SearchForUserError>;

type GetSearchForUserQueryOptions = UseSearchForUserOptions & {
  session: { userId: string } | undefined;
  redditProvider: RedditProvider | null | undefined;
  queryClient: QueryClient;
  wagmiConfig: Config;
};

type SearchForUserOptions = RequiredNonNullable<GetSearchForUserQueryOptions>;

export function parseQuery(rawQuery: string): ParsedQuery {
  const query = rawQuery.trim();
  if (!query) {
    return { type: "invalid-query", reason: "empty" };
  }
  if (/\s/.test(query)) {
    return { type: "invalid-query", reason: "multiple" };
  }

  const prefixedUsername =
    /^(https?:\/\/([\w-]+\.)?reddit.com\/)?u(ser)?\/(?<name>.+)$/i.exec(query);
  if (prefixedUsername) {
    const name = prefixedUsername.groups!.name;
    assert(name);
    return parseUsername(name);
  }

  // Address-like strings <= 20 chars are valid usernames, so require at least
  // 21 chars before considering it an address.
  if (query.length > 20 && /^0[xX]/.test(query)) {
    if (isAddress(query)) return { type: "address", value: getAddress(query) };
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
      return { type: "ens-name", value: normalize(query) };
    } catch (e) {
      return { type: "invalid-query", reason: "ens-name" };
    }
  }

  return parseUsername(query);
}

function parseUsername(query: string): UsernameQuery | InvalidParsedQuery {
  if (/^[\w-]+$/.test(query)) {
    if (query.length > 20) {
      return { type: "invalid-query", reason: "username-length" };
    }
    return { type: "username", value: query.toLowerCase() };
  }

  return { type: "invalid-query", reason: "username" };
}

// TODO: replace with parsedQueryEqual?
export function getParsedQueryKey(parsedQuery: ParsedQuery): string {
  return `${parsedQuery.type}:${parsedQuery.type === "invalid-query" ? parsedQuery.reason : parsedQuery.type}`;
}

export function parsedQueryEqual(a: ParsedQuery, b: ParsedQuery): boolean {
  if (a.type === "invalid-query") {
    return b.type === "invalid-query" && a.reason === b.reason;
  }
  return a.type === b.type && a.value === b.value;
}

async function searchForUser({
  query,
  ...options
}: SearchForUserOptions): Promise<SearchForUserResult> {
  switch (query.type) {
    case "username": {
      return await searchForUserByUsername({ query, ...options });
    }
    case "address": {
      return await searchForUserByVaultAddress({ query, ...options });
    }
    case "ens-name": {
      return await searchForUserByEnsName({ query, ...options });
    }
  }
  assertUnreachable(query);
}

// TODO: normalise username in ENS text, e.g. allow u/foo or https://reddit.com/u/foo
// maybe in query parser too?

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
  const result = await queryClient.fetchQuery(
    getRedditUserProfileQueryOptions({
      redditProvider,
      session,
      username: query.value,
    }),
  );
  if (!result) return { result: "error", error: { type: "not-found", query } };
  return { result: "ok", value: { username: result.username } };
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
      query: { type: "address", value: query.value },
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
      name: normalize(query.value),
    }),
  );
  if (!address) return { result: "error", error: { type: "not-found", query } };
  return await searchForUserByVaultAddress({
    query: { type: "address", value: address },
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
      name: normalize(query.value),
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
  return !!(options.redditProvider && options.session && options.query);
}

export function getSearchForUserQueryKey(
  query: ValidParsedQuery | undefined,
): QueryKey {
  return ["SearchForUser", query];
}

export function getSearchForUserQueryOptions({
  ...options
}: GetSearchForUserQueryOptions) {
  return queryOptions<Result<SearchForUser, SearchForUserError>>({
    // use the parsed query in the key to normalise the query so that we serve
    // equivalent queries from the cache.
    queryKey: getSearchForUserQueryKey(options.query),
    async queryFn() {
      if (!isEnabled(options)) throw new Error("not enabled");
      return await searchForUser(options);
    },
    enabled: isEnabled(options),
  });
}

export function useSearchForUser({ query }: UseSearchForUserOptions) {
  const queryClient = useQueryClient();
  const wagmiConfig = useConfig();
  const currentUserId = useVaultonomyStore((s) => s.currentUserId);
  const { redditProvider } = useRedditProvider();

  const options: GetSearchForUserQueryOptions = {
    query,
    queryClient,
    redditProvider,
    session: currentUserId ? { userId: currentUserId } : undefined,
    wagmiConfig,
  };
  return useQuery({
    ...getSearchForUserQueryOptions(options),
  });
}
