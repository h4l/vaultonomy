/**
 * This is the server side of our reddit interaction RPC protocol. It's a client
 * of Reddit, but a server from the point of view of our application!
 */
import { JSONRPCErrorException, JSONRPCServer } from "json-rpc-2.0";

import {
  createAddressOwnershipChallenge,
  getRedditUserVaultAddress,
  registerAddressWithAccount,
} from "./api-client";
import { PageData, UserPageData, fetchPageData } from "./page-data";
import {
  ErrorCode,
  RedditCreateAddressOwnershipChallenge,
  RedditGetUserProfile,
  RedditGetUserVaultAddress,
  RedditRegisterAddressWithAccount,
} from "./reddit-interaction-spec";

export const SESSION_EXPIRY_SLOP = 1000 * 60 * 5;

export function createServerSession<
  ServerParams = void,
>(): JSONRPCServer<ServerParams> {
  // Currently there's no need to reddit -> extension notification. The only
  // thing we need to notify of is the Reddit tab closing, but that disconnects
  // the Port we use for message transport, which notifies the client end.
  // If we did need to send notifications we can use JSONRPCServerAndClient in
  // place of JSONRPCServer.
  const service = new JSONRPCServer<ServerParams>({
    errorListener: () => undefined,
  });

  // TODO: we could cache this and re-use it — fetchPageData() shouldn't change
  //   as long as the same user is logged in, and it's probably the slowest
  //   request we make.
  let _sessionData: Promise<PageData> | undefined;
  const getSession = async (): Promise<UserPageData> => {
    if (_sessionData === undefined) {
      _sessionData = fetchPageData();
    }
    const sessionData = await _sessionData;
    if (!sessionData.loggedIn)
      throw new JSONRPCErrorException(
        "User is not logged in to the Reddit website",
        ErrorCode.USER_NOT_LOGGED_IN,
      );

    // Expire a little before the actual expiry date so that we don't actually
    // make requests with a token that is expiring.
    if (Date.now() >= sessionData.auth.expires.getTime() - SESSION_EXPIRY_SLOP)
      throw new JSONRPCErrorException(
        "User auth credentials have expired",
        ErrorCode.SESSION_EXPIRED,
      );
    return sessionData;
  };

  service.addMethod(
    RedditGetUserProfile.name,
    RedditGetUserProfile.signature.implement(async () => {
      const session = await getSession();
      return session.user;
    }),
  );
  service.addMethod(
    RedditCreateAddressOwnershipChallenge.name,
    RedditCreateAddressOwnershipChallenge.signature.implement(
      async (params) => {
        const session = await getSession();
        return await createAddressOwnershipChallenge({
          authToken: session.auth.token,
          address: params.address,
        });
      },
    ),
  );
  service.addMethod(
    RedditRegisterAddressWithAccount.name,
    RedditRegisterAddressWithAccount.signature.implement(async (params) => {
      const session = await getSession();
      await registerAddressWithAccount({
        authToken: session.auth.token,
        address: params.address,
        challengeSignature: params.challengeSignature,
      });
      return null;
    }),
  );
  service.addMethod(
    RedditGetUserVaultAddress.name,
    RedditGetUserVaultAddress.signature.implement(async (params) => {
      const session = await getSession();
      return (
        (await getRedditUserVaultAddress({
          authToken: session.auth.token,
          username: params.username,
        })) ?? null
      );
    }),
  );

  return service;
}
