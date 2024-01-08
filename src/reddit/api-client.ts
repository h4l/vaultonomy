/**
 * This module provides client operations for the parts of Reddit's (internal)
 * API we need to use.
 */
import { z } from "zod";

import { HTTPResponseError } from "../errors/http";
import { EthAddress, EthHexSignature } from "../types";

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
    address: z.string(),
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

const GetRedditUserVaultAddressOptions = APIOptions.extend({
  username: z.string(),
});
export type GetRedditUserVaultAddressOptions = z.infer<
  typeof GetRedditUserVaultAddressOptions
>;

const CryptoContactsResponse = z.object({
  contacts: z
    .record(
      z.string(),
      z
        .object({
          active: z.boolean(),
          address: EthAddress,
          provider: z.string(),
          userId: z.string(),
          username: z.string(),
        })
        .array(),
    )
    .optional(),
});

export async function getRedditUserVaultAddress(
  options: GetRedditUserVaultAddressOptions,
): Promise<string | undefined> {
  const { username, authToken } =
    GetRedditUserVaultAddressOptions.parse(options);
  const params = new URLSearchParams({
    usernames: username,
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
      `HTTP request to get reddit account vault address failed`,
      { response },
    );
  }
  const body = CryptoContactsResponse.parse(await response.json());
  for (const accountRecords of Object.values(body.contacts ?? {})) {
    for (const accountRecord of accountRecords) {
      if (accountRecord.username === username && accountRecord.active) {
        return accountRecord.address;
      }
    }
  }
  return undefined;
}
