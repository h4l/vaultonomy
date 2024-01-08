import { z } from "zod";

import { defineMethod } from "../rpc/typing";
import { EthAddress, EthHexSignature } from "../types";
import { RedditEIP712Challenge } from "./api-client";

// This RPC protocol is connection-oriented — a connection implies a single
// session context, in which one reddit account is the subject of the
// connection's messages. If the reddit account becomes unavailable (e.g. due to
// its auth credentials expiring) then the connection is closed. This is for
// simplicity of implementation — we will typically have one or perhaps a small
// number of active connections, it doesn't seem necessary to multiplex > 1
// session over one connection.
//
// Because of JSON serialisation, we generally need to use null rather than
// undefined in these types.

export const REDDIT_INTERACTION = "reddit-interaction";

export enum ErrorCode {
  USER_NOT_LOGGED_IN = 0,
  SESSION_EXPIRED = 1,
}

export const RedditUserProfile = z.object({
  userID: z.string(),
  username: z.string(),
  hasPremium: z.boolean(),
  accountIconURL: z.string().url(),
  accountIconFullBodyURL: z.string().url(),
});
export type RedditUserProfile = z.infer<typeof RedditUserProfile>;

export const RedditGetUserProfile = defineMethod({
  name: "reddit_getUserProfile",
  params: z.null(),
  returns: RedditUserProfile,
});

export const RedditCreateAddressOwnershipChallengeParams = z.object({
  address: EthAddress,
});
export type RedditCreateAddressOwnershipChallengeParams = z.infer<
  typeof RedditCreateAddressOwnershipChallengeParams
>;

export const RedditCreateAddressOwnershipChallenge = defineMethod({
  name: "reddit_createAddressOwnershipChallenge",
  params: RedditCreateAddressOwnershipChallengeParams,
  returns: RedditEIP712Challenge,
});

export const RedditRegisterAddressWithAccountParams = z.object({
  address: EthAddress,
  challengeSignature: EthHexSignature,
});
export type RedditRegisterAddressWithAccountParams = z.infer<
  typeof RedditRegisterAddressWithAccountParams
>;

export const RedditRegisterAddressWithAccount = defineMethod({
  name: "reddit_registerAddressWithAccount",
  params: RedditRegisterAddressWithAccountParams,
  returns: z.null(),
});

export const RedditGetUserVaultAddressParams = z.object({
  username: z.string(),
});
export type RedditGetUserVaultAddressParams = z.infer<
  typeof RedditGetUserVaultAddressParams
>;

export const RedditGetUserVaultAddress = defineMethod({
  name: "reddit_getUserVaultAddress",
  params: RedditGetUserVaultAddressParams,
  returns: EthAddress.nullable(),
});
