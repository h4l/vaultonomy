/**
 * This module provides client operations for the parts of Reddit's (internal)
 * API we need to use.
 */
import { Address, getAddress } from "viem";
import { z } from "zod";

import { HTTPResponseError } from "../errors/http";
import { EthAddress, EthHexSignature, RawEthAddress } from "../types";
import { RedditUserProfile } from "./types";

// TODO: review how strictly we validate the challenge structure.
// We need to be sure that we're presenting a challenge for Reddit, so it
// certainly makes sense to ensure that the EIP712Domain is reddit-specific.
// Note that the order of fields in the arrays under types is significant.
// We should probably only loosely validate the challenge here, and allow more
// precise validation closer to the UI, where errors can be better handled.
export const RedditEIP712Challenge = z.object({
  domain: z.object({
    chainId: z.string(),
    name: z.literal("reddit"),
    salt: z.string(),
    // Note: verifyingContract is normally a contract address, but there's a
    // quirk in Reddit's data. They provide an empty string for this value, but
    // the verifyingContract field is not actually included in their domain
    // type, so the field is ignored when parsing this JSON representation of
    // the EIP712 structured data.
    verifyingContract: z.string().nullish(),
    version: z.string(),
  }),
  message: z.object({
    address: RawEthAddress,
    expiresAt: z.string(),
    nonce: z.string(),
    redditUserName: z.string(),
  }),
  primaryType: z.literal("Challenge"),
  types: z.object({
    Challenge: z.object({ name: z.string(), type: z.string() }).array(),
    EIP712Domain: z.tuple([
      z.object({ name: z.literal("name"), type: z.literal("string") }),
      z.object({ name: z.literal("chainId"), type: z.literal("uint256") }),
      z.object({ name: z.literal("version"), type: z.literal("string") }),
      z.object({ name: z.literal("salt"), type: z.literal("string") }),
    ]),
  }),
});
export type RedditEIP712Challenge = z.infer<typeof RedditEIP712Challenge>;

const ChallengeResponse = z.object({
  payload: RedditEIP712Challenge,
});

const APIOptions = z.object({
  authToken: z.string(),
});
type APIOptions = z.infer<typeof APIOptions>;

const CreateAddressOwnershipChallengeOptions = APIOptions.extend({
  /** The Ethereum address to be associated. */
  address: EthAddress,
  timestamp: z.number().optional(),
});
type CreateAddressOwnershipChallengeOptions = z.infer<
  typeof CreateAddressOwnershipChallengeOptions
>;

/** Create and obtain challenge data to prove ownership of an Eth address.
 *
 * This challenge data is EIP712 structured data with a domain scoped to Reddit
 * (so it can't be re-used elsewhere) and containing details of the Eth address
 * to be associated (the options.address) and the Reddit username that the
 * address will be linked with (implied by the options.authToken).
 *
 * Once signed, registerAddressWithAccount() can be used to actually establish
 * the link.
 */
export async function createAddressOwnershipChallenge(
  options: CreateAddressOwnershipChallengeOptions,
): Promise<RedditEIP712Challenge> {
  const { address, timestamp, authToken } =
    CreateAddressOwnershipChallengeOptions.parse(options);
  const params = new URLSearchParams({
    request_timestamp: `${timestamp ?? Date.now()}`,
  });
  const response = await fetch(
    `https://meta-api.reddit.com/crypto/ethereum/challenges?${params}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${authToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        address: address.toLowerCase(),
        challengeType: "registration-challenge-EIP712",
      }),
    },
  );
  if (!response.ok) {
    throw new HTTPResponseError(
      `HTTP request to create address ownership challenge failed`,
      { response },
    );
  }
  const body = ChallengeResponse.parse(await response.json());
  return body.payload;
}

const RegisterAddressWithAccountOptions = APIOptions.extend({
  address: EthAddress,
  challengeSignature: EthHexSignature,
  timestamp: z.number().optional(),
});
type RegisterAddressWithAccountOptions = z.infer<
  typeof RegisterAddressWithAccountOptions
>;

/** Link an Eth address with a Reddit account.
 *
 * The address being linked needs to sign the challenge data previously
 * created by & obtained from createAddressOwnershipChallenge().
 */
export async function registerAddressWithAccount(
  options: RegisterAddressWithAccountOptions,
): Promise<void> {
  const { address, challengeSignature, authToken, timestamp } =
    RegisterAddressWithAccountOptions.parse(options);
  const params = new URLSearchParams({
    request_timestamp: `${timestamp ?? Date.now()}`,
  });
  const response = await fetch(
    `https://meta-api.reddit.com/crypto/ethereum/registrations?${params}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${authToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        address: address.toLowerCase(),
        registrationType: "crypto-registration-EIP712",
        signature: challengeSignature,
      }),
    },
  );
  if (!response.ok) {
    throw new HTTPResponseError(
      `HTTP request to register address with account failed`,
      { response },
    );
  }
}

export const GetRedditUserVaultQueryOptions = z.discriminatedUnion("type", [
  z.object({ type: z.literal("username"), value: z.string() }),
  z.object({ type: z.literal("address"), value: EthAddress }),
]);
export type GetRedditUserVaultQueryOptions = z.infer<
  typeof GetRedditUserVaultQueryOptions
>;

export const GetRedditUserVaultOptions = APIOptions.extend({
  query: GetRedditUserVaultQueryOptions,
});
export type GetRedditUserVaultOptions = z.infer<
  typeof GetRedditUserVaultOptions
>;

const RawVault = z.object({
  active: z.boolean(),
  address: EthAddress,
  provider: z.string(),
  userId: z.string(),
  username: z.string(),
});
type RawVault = z.infer<typeof RawVault>;
const CryptoContactsResponse = z.object({
  contacts: z.record(z.string(), RawVault.array()).optional(),
});

export const RedditUserVault = z.object({
  address: EthAddress,
  userId: z.string(),
  username: z.string(),
  isActive: z.boolean().nullish(),
});
export type RedditUserVault = z.infer<typeof RedditUserVault>;

export async function getRedditUserVault(
  options: GetRedditUserVaultOptions,
): Promise<RedditUserVault | undefined> {
  const {
    authToken,
    query: { type, value },
  } = GetRedditUserVaultOptions.parse(options);

  const matchValue = value.toLowerCase();
  const queryValue = type === "address" ? getAddress(value) : matchValue;

  // The API supports multiple values separated by , as well as querying by
  // username and address simultaneously. However we don't need this, so I'm
  // only exposing single value queries.
  const params = new URLSearchParams({
    [type === "address" ? "addresses" : "usernames"]: queryValue,
  });
  const response = await fetch(
    `https://meta-api.reddit.com/crypto-contacts?${params}`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${authToken}`,
        "content-type": "application/json",
      },
    },
  );
  if (!response.ok) {
    throw new HTTPResponseError(
      `HTTP request to get vault address of reddit user failed`,
      { response },
    );
  }
  const body = CryptoContactsResponse.parse(await response.json());

  let matchingVault: RawVault | undefined;
  // This is a little more involved than is probably necessary, but worth being
  // cautious given the undocumented nature of this API. Generally there'll be
  // a single vault value in the response for the way we search with a single
  // query value.
  for (const rawVaults of Object.values(body.contacts ?? {})) {
    for (const rawVault of rawVaults) {
      if (
        !(
          (type === "username" &&
            matchValue === rawVault.username.toLowerCase()) ||
          (type === "address" && matchValue == rawVault.address.toLowerCase())
        )
      )
        continue;
      if (rawVault.provider !== "ethereum") continue;
      if (rawVault.active) {
        matchingVault = rawVault;
        break;
      }
      matchingVault = rawVault;
      // continue searching in case there's an active vault
    }
  }
  if (!matchingVault) return undefined;
  return {
    address: matchingVault.address,
    userId: matchingVault.userId,
    username: matchingVault.username,
    isActive: matchingVault.active,
  };
}

const AccountVaultAddressesResponse = z.object({
  // The response omits the top-level addresses prop for accounts with no vault.
  addresses: z
    .object({
      ethereum: z
        .array(
          z
            .object({
              address: EthAddress,
              createdAt: z.number(),
              modifiedAt: z.number().nullish(),
              isActive: z.boolean().nullish(),
            })
            .nullish(),
        )
        .nullish(),
    })
    .nullish(),
});

export const AccountVaultAddress = z.object({
  address: EthAddress,
  // Keep dates as timestamps, as we need to serialise them as JSON again anyway
  createdAt: z.number(),
  // This response used to not provide modifiedAt. It now includes it and seems
  // to default to createdAt. Not sure in what events (if any) cause it to
  // change. Should try re-pairing and old address and see if it results in a
  // new entry, or if the existing address has its modifiedAt date changed.
  modifiedAt: z.number().nullable(),
  isActive: z.boolean(),
});
export type AccountVaultAddress = z.infer<typeof AccountVaultAddress>;

export async function getRedditAccountVaultAddresses(
  options: APIOptions,
): Promise<Array<AccountVaultAddress>> {
  const { authToken } = APIOptions.parse(options);
  const response = await fetch(
    `https://meta-api.reddit.com/users/me?fields=addresses`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${authToken}`,
        "content-type": "application/json",
      },
    },
  );
  if (!response.ok) {
    throw new HTTPResponseError(
      `HTTP request to get reddit account vault addresses failed`,
      { response },
    );
  }
  const body = AccountVaultAddressesResponse.parse(await response.json());
  const addresses: Array<AccountVaultAddress> = [];

  for (const rawAddress of Object.values(body.addresses?.ethereum ?? [])) {
    if (!rawAddress) continue;
    addresses.push({
      address: rawAddress.address,
      createdAt: rawAddress.createdAt,
      modifiedAt: rawAddress.modifiedAt ?? null,
      isActive: rawAddress.isActive ?? false,
    });
  }
  return addresses;
}

const GetRedditUserProfileOptions = APIOptions.extend({
  username: z.string(),
});
export type GetRedditUserProfileOptions = z.infer<
  typeof GetRedditUserProfileOptions
>;

const UserProfileResponse = z.object({
  data: z.object({
    id: z.string(),
    name: z.string(),
    is_gold: z.boolean(),
    icon_img: z.string().url(),
    snoovatar_img: z.string().url().nullable(),
  }),
});
type UserProfileResponse = z.infer<typeof UserProfileResponse>;

/**
 * Get the profile of a user other than the session's user.
 */
export async function getRedditUserProfile(
  options: GetRedditUserProfileOptions,
): Promise<RedditUserProfile> {
  const { username, authToken } = GetRedditUserProfileOptions.parse(options);
  const response = await fetch(
    `https://oauth.reddit.com/user/${encodeURIComponent(username)}/about.json`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${authToken}`,
        "content-type": "application/json",
      },
    },
  );
  if (!response.ok) {
    throw new HTTPResponseError(
      `HTTP request to get reddit user profile failed`,
      { response },
    );
  }
  const { data } = UserProfileResponse.parse(await response.json());
  return {
    userID: `t2_${data.id}`,
    username: data.name,
    hasPremium: data.is_gold,
    accountIconURL: data.icon_img,
    accountIconFullBodyURL: data.snoovatar_img,
  };
}
