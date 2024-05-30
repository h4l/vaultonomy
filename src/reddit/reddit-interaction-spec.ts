import { z } from "zod";

import { PortName } from "../PortName";
import { defineMethod } from "../rpc/typing";
import { EthAddress, EthHexSignature } from "../types";
import {
  AccountVaultAddress,
  GetRedditUserVaultQueryOptions,
  RedditEIP712Challenge,
  RedditUserVault,
} from "./api-client";
import { AnyRedditUserProfile } from "./types";

export { RedditUserProfile } from "./types";

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

export const REDDIT_INTERACTION_PORT_NAME = new PortName("reddit-interaction");

export enum ErrorCode {
  USER_NOT_LOGGED_IN = 1,
  // tab was not available to start request
  REDDIT_TAB_NOT_CONNECTED = 2,
  // tab was available but closed during request
  REDDIT_TAB_DISCONNECTED = 3,
  WRONG_USER = 4,
  NOT_FOUND = 5,
  // An API call request & response was successful, but Reddit refused or failed
  // to process to API method. This usually indicates a non-retryable error, but
  // could be due to a temporary problem on Reddit's side.
  REDDIT_API_UNSUCCESSFUL = 6,
}
const errorCodeValues: Set<string | ErrorCode> = new Set(
  Object.values(ErrorCode),
);

export function isErrorCode(num: number): num is ErrorCode {
  return errorCodeValues.has(num);
}

export const Session = z.object({ userId: z.string() });
export type Session = z.infer<typeof Session>;

export const RedditGetOwnUserProfileParams = z.object({
  session: Session.nullish(),
  username: z.null().optional(),
});
export type RedditGetOwnUserProfileParams = z.infer<
  typeof RedditGetOwnUserProfileParams
>;

export const RedditGetOtherUserProfileParams = z.object({
  session: Session.nullish(),
  username: z.string(),
});
export type RedditGetOtherUserProfileParams = z.infer<
  typeof RedditGetOtherUserProfileParams
>;

export const RedditGetUserProfileParams = z.union([
  RedditGetOwnUserProfileParams,
  RedditGetOtherUserProfileParams,
]);
export type RedditGetUserProfileParams = z.infer<
  typeof RedditGetUserProfileParams
>;

export const RedditGetUserProfile = defineMethod({
  name: "reddit_getUserProfile",
  params: RedditGetUserProfileParams.nullable(),
  returns: AnyRedditUserProfile,
});

export const RedditCreateAddressOwnershipChallengeParams = z.object({
  session: Session,
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
  session: Session,
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

export const RedditGetUserVaultParams = z.object({
  query: GetRedditUserVaultQueryOptions,
});
export type RedditGetUserVaultParams = z.infer<typeof RedditGetUserVaultParams>;

export const RedditGetUserVault = defineMethod({
  name: "reddit_getUserVault",
  params: RedditGetUserVaultParams,
  returns: RedditUserVault.nullable(),
});

export const RedditGetAccountVaultAddressesParams = z.object({
  session: Session,
});
export type RedditGetAccountVaultAddressesParams = z.infer<
  typeof RedditGetAccountVaultAddressesParams
>;

export const RedditGetAccountVaultAddresses = defineMethod({
  name: "reddit_getAccountVaultAddresses",
  params: RedditGetAccountVaultAddressesParams,
  returns: z.array(AccountVaultAddress),
});
