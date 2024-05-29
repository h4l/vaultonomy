/**
 * This module provides client operations for the parts of Reddit's (internal)
 * API we need to use.
 */
import { Address, Hex } from "viem";
import { z } from "zod";

import { HTTPResponseError } from "../errors/http";
import {
  EthAddress,
  EthHexSignature,
  RawEthAddress,
  parseJSON,
} from "../types";
import { APIError, GqlFedOperation } from "./gql-fed-api";
import { AnyRedditUserProfile } from "./types";

const APIOptions = z.object({ authToken: z.string() });
type APIOptions = z.infer<typeof APIOptions>;

const RedditEIP712ChallengeMessage = z.object({
  address: RawEthAddress,
  expiresAt: z.string(),
  nonce: z.string(),
  redditUserName: z.string(),
});

const RedditEIP712ChallengeDomain = z.object({
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
});
const RedditEIP712ChallengeTypes = z.object({
  Challenge: z.object({ name: z.string(), type: z.string() }).array(),
  EIP712Domain: z.tuple([
    z.object({ name: z.literal("name"), type: z.literal("string") }),
    z.object({ name: z.literal("chainId"), type: z.literal("uint256") }),
    z.object({ name: z.literal("version"), type: z.literal("string") }),
    z.object({ name: z.literal("salt"), type: z.literal("string") }),
  ]),
});

// TODO: review how strictly we validate the challenge structure.
// We need to be sure that we're presenting a challenge for Reddit, so it
// certainly makes sense to ensure that the EIP712Domain is reddit-specific.
// Note that the order of fields in the arrays under types is significant.
// We should probably only loosely validate the challenge here, and allow more
// precise validation closer to the UI, where errors can be better handled.
export const RedditEIP712Challenge = z.object({
  domain: RedditEIP712ChallengeDomain,
  message: RedditEIP712ChallengeMessage,
  primaryType: z.literal("Challenge"),
  types: RedditEIP712ChallengeTypes,
});
export type RedditEIP712Challenge = z.infer<typeof RedditEIP712Challenge>;

const GetVaultRegistrationChallengeResponse = z.object({
  data: z.object({
    vault: z.object({
      registrationChallenge: z.object({
        payload: z.object({
          // The domain and message values are supposed to be object values, but
          // they are JSON-encoded strings in the API response. Because this is
          // non-standard, we support both the normal EIP-712 object value, or
          // the re-encoded JSON string that the API uses, as it seems like the
          // kind of thing they might undo.
          domain: RedditEIP712ChallengeDomain.or(
            z.string().transform(parseJSON).pipe(RedditEIP712ChallengeDomain),
          ),
          message: RedditEIP712ChallengeMessage.or(
            z.string().transform(parseJSON).pipe(RedditEIP712ChallengeMessage),
          ),
          primaryType: z.literal("Challenge"),
          // I guess the people that implemented this API didn't know that
          // this is data in EIP-712 format with quite a specific structure 🙃
          // The types' capitalisation is messed up, so we need to normalise it
          // back to what EIP-712 requires. Type names are camelCase not
          // CamelCase. Type values are UPPERCASE not lowercase.
          types: z
            .record(
              z.string().toLowerCase(), // we'll fix this in transform
              z
                .object({
                  name: z.string(),
                  type: z.string().toLowerCase(),
                })
                .array(),
            )
            .transform((arg) => ({
              Challenge: arg.challenge,
              EIP712Domain: arg.eip712domain,
            }))
            .pipe(RedditEIP712ChallengeTypes),
        }),
      }),
    }),
  }),
});

const GetVaultRegistrationChallengeQuery = (address: Address) =>
  JSON.stringify({
    extensions: {
      persistedQuery: {
        sha256Hash:
          "8289463da9d631b4f715b6ab6f97d2a7ac59dc8ed2bd005a3b6f5d96dab57be5",
        version: 1,
      },
    },
    operationName: "GetVaultRegistrationChallenge",
    variables: {
      address: address.toLowerCase(),
      provider: "ethereum",
    },
  });

const CreateAddressOwnershipChallengeOptions = APIOptions.extend({
  /** The Ethereum address to be associated. */
  address: EthAddress,
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
  options: z.input<typeof CreateAddressOwnershipChallengeOptions>,
): Promise<RedditEIP712Challenge> {
  const { address, authToken } =
    CreateAddressOwnershipChallengeOptions.parse(options);

  const response = await fetch("https://gql-fed.reddit.com/", {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${authToken}`,
      "content-type": "application/json",
    },
    body: GetVaultRegistrationChallengeQuery(address),
  });
  if (!response.ok) {
    throw new HTTPResponseError(
      `HTTP request to create address ownership challenge failed`,
      { response },
    );
  }
  const body = GetVaultRegistrationChallengeResponse.parse(
    await response.json(),
  );
  return body.data.vault.registrationChallenge.payload;
}

const RegisterAddressWithAccountOptions = APIOptions.extend({
  address: EthAddress,
  challengeSignature: EthHexSignature,
});
type RegisterAddressWithAccountOptions = z.infer<
  typeof RegisterAddressWithAccountOptions
>;

const registerAddressWithAccountOp = GqlFedOperation.create({
  operationName: "RegisterVaultAddress",
  persistedQuerySha256:
    "396dab0e8ce1d8ffbc4f149b554c7548d6b995fa64c1f0e3e675758ff6e84448",
  description: "register address with account",
  responseDataSchema: z.object({
    registerVaultAddress: z.object({
      errors: z.any(),
      ok: z.boolean().nullish(),
    }),
  }),
  variablesSchema: z.object({
    input: z.object({
      address: EthAddress.transform((s) => s.toLowerCase()),
      provider: z.literal("ethereum"),
      signature: EthHexSignature,
    }),
  }),
});

/** Link an Eth address with a Reddit account.
 *
 * The address being linked needs to sign the challenge data previously
 * created by & obtained from createAddressOwnershipChallenge().
 */
export async function registerAddressWithAccount(
  options: z.input<typeof RegisterAddressWithAccountOptions>,
): Promise<void> {
  const {
    address,
    challengeSignature: signature,
    authToken,
  } = RegisterAddressWithAccountOptions.parse(options);

  const data = await registerAddressWithAccountOp.makeRequest({
    authToken,
    vars: { input: { address, provider: "ethereum", signature } },
  });

  if (data.registerVaultAddress.ok) return;

  throw new APIError(
    `API request to register address with account received successful ` +
      `response with error in response body: ${data.registerVaultAddress.errors}`,
  );
}

export const GetRedditUserVaultQueryOptions = z.object({
  userId: z.string(),
});
export type GetRedditUserVaultQueryOptions = z.infer<
  typeof GetRedditUserVaultQueryOptions
>;

export const GetRedditUserVaultOptions = APIOptions.extend(
  GetRedditUserVaultQueryOptions.shape,
);
export type GetRedditUserVaultOptions = z.infer<
  typeof GetRedditUserVaultOptions
>;

export const RedditUserVault = z.object({
  address: EthAddress,
  userId: z.string(),
  isActive: z.boolean(),
});
export type RedditUserVault = z.infer<typeof RedditUserVault>;

const GetUserVaultQueryResponse = z.object({
  data: z.object({
    vault: z.object({
      contact: RedditUserVault.nullable(),
    }),
  }),
});
type GetUserVaultQueryResponse = z.infer<typeof GetUserVaultQueryResponse>;

const GetUserVaultQuery = (userId: string) =>
  JSON.stringify({
    extensions: {
      persistedQuery: {
        sha256Hash:
          "a2ca9a4361d8511ce75609b34844229e5691bfc3936c6fe029439f8426d33084",
        version: 1,
      },
    },
    operationName: "GetUserVault",
    variables: {
      provider: "ethereum",
      userId: userId,
    },
  });

export async function getRedditUserVault(
  options: z.input<typeof GetRedditUserVaultOptions>,
): Promise<RedditUserVault | undefined> {
  const { authToken, userId } = GetRedditUserVaultOptions.parse(options);

  const response = await fetch("https://gql-fed.reddit.com/", {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${authToken}`,
      "content-type": "application/json",
    },
    body: GetUserVaultQuery(userId),
  });
  if (!response.ok) {
    throw new HTTPResponseError(
      `HTTP request to get vault address of reddit user failed`,
      { response },
    );
  }
  const body = GetUserVaultQueryResponse.parse(await response.json());

  return body.data.vault.contact ?? undefined;
}

export const AccountVaultAddress = z.object({
  address: EthAddress,
  createdAt: z.number().nonnegative(),
  isActive: z.boolean(),
});
export type AccountVaultAddress = z.infer<typeof AccountVaultAddress>;

const GetAllVaultsQuery = JSON.stringify({
  extensions: {
    persistedQuery: {
      sha256Hash:
        "2ab376466d1a57a79f0ffb2b6cbdd0ead3c3b26cbdcf352c1360c1df60ed12cb",
      version: 1,
    },
  },
  operationName: "GetAllVaults",
  variables: {
    provider: "ethereum",
  },
});

const GetAllVaultsQueryResponse = z.object({
  data: z.object({
    vault: z.object({
      addresses: z
        .object({
          address: EthAddress,
          createdAt: z
            .string()
            .datetime({ offset: true })
            .transform(Date.parse),
          isActive: z.boolean(),
          provider: z.string().nullish(),
        })
        .array(),
    }),
  }),
});

export async function getRedditAccountVaultAddresses(
  options: z.input<typeof APIOptions>,
): Promise<Array<AccountVaultAddress>> {
  const { authToken } = APIOptions.parse(options);
  const response = await fetch(`https://gql-fed.reddit.com/`, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${authToken}`,
      "content-type": "application/json",
    },
    body: GetAllVaultsQuery,
  });
  if (!response.ok) {
    throw new HTTPResponseError(
      `HTTP request to get reddit account vault addresses failed`,
      { response },
    );
  }
  const body = GetAllVaultsQueryResponse.parse(await response.json());
  const addresses: Array<AccountVaultAddress> = [];

  for (const rawAddress of body.data.vault.addresses) {
    if (rawAddress?.provider !== "ethereum") continue;
    addresses.push({
      address: rawAddress.address,
      createdAt: rawAddress.createdAt,
      isActive: rawAddress.isActive,
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
  data: z
    .object({
      id: z.string(),
      name: z.string(),
      is_gold: z.boolean(),
      icon_img: z.string().url(),
      snoovatar_img: z.string().url().nullable().catch(null),
      // This doesn't exist in the response (unless it's true), but we include
      // it manually to distinguish between the types.
      is_suspended: z.literal(false).catch(false),
    })
    .or(
      z.object({
        name: z.string(),
        is_suspended: z.literal(true),
      }),
    ),
});
type UserProfileResponse = z.infer<typeof UserProfileResponse>;

/**
 * Get the profile of a user other than the session's user.
 */
export async function getRedditUserProfile(
  options: z.input<typeof GetRedditUserProfileOptions>,
): Promise<AnyRedditUserProfile> {
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
  return data.is_suspended ?
      { username: data.name, isSuspended: true }
    : {
        isSuspended: false,
        userID: `t2_${data.id}`,
        username: data.name,
        hasPremium: data.is_gold,
        accountIconURL: data.icon_img,
        accountIconFullBodyURL: data.snoovatar_img,
      };
}
