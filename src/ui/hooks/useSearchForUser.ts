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
import { log } from "../../logging";
import { RedditProvider } from "../../reddit/reddit-interaction-client";
import { RequiredNonNullable } from "../../types";
import { Result } from "../state/createVaultonomyStore";
import { useVaultonomyStore } from "../state/useVaultonomyStore";
import { useRedditProvider } from "./useRedditProvider";
import { getRedditUserProfileQueryOptions } from "./useRedditUserProfile";
import {
  getRedditUserVaultQueryOptions,
  prefetchRedditUserVault,
} from "./useRedditUserVault";

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

export type NotFoundReason =
  | "username-not-found"
  | "address-not-a-vault"
  | "ens-name-has-no-address"
  | "ens-name-address-not-a-vault"
  | "ens-name-has-no-com-reddit"
  | "ens-name-com-reddit-username-not-found";
export type SearchForUserNotFoundError = {
  type: "not-found";
  tags: NotFoundReason[];
  query: ValidParsedQuery;
};
type SearchForUserError = SearchForUserNotFoundError;
type SearchForUser = { username: string };
export type SearchForUserResult = Result<SearchForUser, SearchForUserError>;

type GetSearchForUserQueryOptions = UseSearchForUserOptions & {
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
    /^(https?:\/\/([\w-]+\.)?reddit.com\/)?u(ser)?\/(?<name>[\w-]+)\/*$/i.exec(
      query,
    );
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

export function parseUsername(
  query: string,
): UsernameQuery | InvalidParsedQuery {
  if (/^[\w-]+$/.test(query)) {
    if (query.length > 20) {
      return { type: "invalid-query", reason: "username-length" };
    }
    return { type: "username", value: normaliseUsername(query) };
  }

  return { type: "invalid-query", reason: "username" };
}

export function normaliseUsername(username: string): string {
  return username.toLowerCase();
}

export function normaliseQuery(query: ParsedQuery): ParsedQuery {
  try {
    if (query.type === "username") {
      const normalisedUsername = normaliseUsername(query.value);
      return normalisedUsername === query.value ?
          query
        : { type: "username", value: normalisedUsername };
    } else if (query.type === "address") {
      const normalisedAddress = getAddress(query.value);
      return normalisedAddress === query.value ?
          query
        : { type: "address", value: normalisedAddress };
    } else if (query.type === "ens-name") {
      const normalisedEnsName = normalize(query.value);
      return normalisedEnsName === query.value ?
          query
        : { type: "ens-name", value: normalisedEnsName };
    }
  } catch (cause) {
    throw new Error("Failed to normalise invalid query", { cause });
  }
  return query;
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
  redditProvider,
  queryClient,
}: {
  query: UsernameQuery;
} & Pick<
  SearchForUserOptions,
  "redditProvider" | "queryClient"
>): Promise<SearchForUserResult> {
  const result = await queryClient.fetchQuery(
    getRedditUserProfileQueryOptions({
      redditProvider,
      username: query.value,
    }),
  );
  if (!result)
    return {
      result: "error",
      error: { type: "not-found", query, tags: ["username-not-found"] },
    };
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
  if (!result)
    return {
      result: "error",
      error: { type: "not-found", query, tags: ["address-not-a-vault"] },
    };
  return { result: "ok", value: { username: result.username } };
}

async function searchForUserByEnsName({
  ...options
}: {
  query: EnsNameQuery;
} & SearchForUserOptions): Promise<SearchForUserResult> {
  const [byAddress, byTxtRecord] = await Promise.all([
    searchForUserByEnsNameAddress(options),
    searchForUserByEnsNameTxtRecord(options),
  ]);
  // Prefer resolving by vault address match, as this has a cryptographic chain,
  // whereas anyone can create a com.reddit txt record.
  if (byAddress.result === "ok") return byAddress;
  if (byTxtRecord.result === "ok") return byTxtRecord;

  assert(byAddress.error.type === "not-found");
  assert(byTxtRecord.error.type === "not-found");
  // Merge the not found reasons
  return {
    result: "error",
    error: {
      type: "not-found",
      query: options.query,
      tags: [...byAddress.error.tags, ...byTxtRecord.error.tags],
    },
  };
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
  if (!address)
    return {
      result: "error",
      error: { type: "not-found", query, tags: ["ens-name-has-no-address"] },
    };
  const user = await searchForUserByVaultAddress({
    query: { type: "address", value: address },
    queryClient,
    ...options,
  });
  if (user.result === "ok") return user;
  return {
    result: "error",
    error: { type: "not-found", query, tags: ["ens-name-address-not-a-vault"] },
  };
}

async function searchForUserByEnsNameTxtRecord({
  query,
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
  if (!result) {
    return {
      result: "error",
      error: { type: "not-found", query, tags: ["ens-name-has-no-com-reddit"] },
    };
  }
  const validated = parseQuery(result);
  if (validated.type === "username") {
    const user = await searchForUserByUsername({
      query: validated,
      queryClient,
      redditProvider,
    });
    if (user.result === "ok") return user;
  }
  return {
    result: "error",
    error: {
      type: "not-found",
      query,
      tags: ["ens-name-com-reddit-username-not-found"],
    },
  };
}

function isEnabled(
  options: GetSearchForUserQueryOptions,
): options is RequiredNonNullable<GetSearchForUserQueryOptions> {
  return !!(options.redditProvider && options.query);
}

export function getSearchForUserQueryKey(
  query: ValidParsedQuery | undefined,
): QueryKey {
  return ["SearchForUser", query ? normaliseQuery(query) : undefined];
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

      // If we're searching for a username and it matches we'll subsequently
      // request the user's value by username, so we can start doing that now to
      // speed up vault loading. (No point in pre-fetching an address query, as
      // they request a vault by address anyway.)
      if (options.query.type === "username") {
        prefetchRedditUserVault({
          query: options.query,
          queryClient: options.queryClient,
          redditProvider: options.redditProvider,
        });
      }

      return await searchForUser(options);
    },
    throwOnError: (e) => {
      log.error("search for user failed:", e);
      return false;
    },
    enabled: isEnabled(options),
    // TODO: tune this value
    staleTime: 1000 * 60 * 5,
  });
}

export function useSearchForUser({ query }: UseSearchForUserOptions) {
  const queryClient = useQueryClient();
  const wagmiConfig = useConfig();
  const { redditProvider } = useRedditProvider();

  const options: GetSearchForUserQueryOptions = {
    query,
    queryClient,
    redditProvider,
    wagmiConfig,
  };
  return useQuery({
    ...getSearchForUserQueryOptions(options),
  });
}

export async function prefetchSearchForUser(
  options: UseSearchForUserOptions & GetSearchForUserQueryOptions,
): Promise<void> {
  if (!isEnabled(options)) {
    log.warn("Cannot prefetch SearchForUser: options not enabled");
    return;
  }

  log.debug("prefetchSearchForUser", options.query.value);
  return options.queryClient.prefetchQuery(
    getSearchForUserQueryOptions(options),
  );
}
