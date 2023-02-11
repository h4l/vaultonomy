/**
 * This is the server side of our reddit interaction RPC protocol. It's a client
 * of Reddit, but a server from the point of view of our application!
 */
import {
  JSONRPCClient,
  JSONRPCErrorException,
  JSONRPCServer,
  JSONRPCServerAndClient,
  SendRequest,
} from "json-rpc-2.0";

import {
  createAddressOwnershipChallenge,
  getRedditAccountVaultAddress,
  registerAddressWithAccount,
} from "./api-client";
import { PageData, UserPageData, fetchPageData } from "./page-data";
import {
  ErrorCode,
  RedditCreateAddressOwnershipChallenge,
  RedditGetAccountVaultAddress,
  RedditGetUserProfile,
  RedditRegisterAddressWithAccount,
} from "./reddit-interaction-spec";

export const SESSION_EXPIRY_SLOP = 1000 * 60 * 5;

export function createServerSession<
  ServerParams = void,
  ClientParams = void
>(options: {
  sendRequestViaTransport: SendRequest<ClientParams>;
}): JSONRPCServerAndClient<ServerParams, ClientParams> {
  const service = new JSONRPCServerAndClient<ServerParams, ClientParams>(
    new JSONRPCServer({ errorListener: () => undefined }),
    new JSONRPCClient(options.sendRequestViaTransport)
  );

  let _sessionData: Promise<PageData> | undefined;
  const getSession = async (): Promise<UserPageData> => {
    if (_sessionData === undefined) {
      _sessionData = fetchPageData();
    }
    const sessionData = await _sessionData;
    if (!sessionData.loggedIn)
      throw new JSONRPCErrorException(
        "User is not logged in to the Reddit website",
        ErrorCode.USER_NOT_LOGGED_IN
      );

    // Expire a little before the actual expiry date so that we don't actually
    // make requests with a token that is expiring.
    if (Date.now() >= sessionData.auth.expires.getTime() - SESSION_EXPIRY_SLOP)
      throw new JSONRPCErrorException(
        "User auth credentials have expired",
        ErrorCode.SESSION_EXPIRED
      );
    return sessionData;
  };

  service.server.addMethod(
    RedditGetUserProfile.name,
    RedditGetUserProfile.signature.implement(async () => {
      const session = await getSession();
      return session.user;
    })
  );
  service.server.addMethod(
    RedditCreateAddressOwnershipChallenge.name,
    RedditCreateAddressOwnershipChallenge.signature.implement(
      async (params) => {
        const session = await getSession();
        return await createAddressOwnershipChallenge({
          authToken: session.auth.token,
          address: params.address,
        });
      }
    )
  );
  service.server.addMethod(
    RedditRegisterAddressWithAccount.name,
    RedditRegisterAddressWithAccount.signature.implement(async (params) => {
      const session = await getSession();
      await registerAddressWithAccount({
        authToken: session.auth.token,
        address: params.address,
        challengeSignature: params.challengeSignature,
      });
      return null;
    })
  );
  service.server.addMethod(
    RedditGetAccountVaultAddress.name,
    RedditGetAccountVaultAddress.signature.implement(async () => {
      const session = await getSession();
      return (
        (await getRedditAccountVaultAddress({
          authToken: session.auth.token,
          username: session.user.username,
        })) ?? null
      );
    })
  );

  return service;
}
