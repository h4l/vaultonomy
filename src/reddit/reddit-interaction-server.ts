/**
 * This is the server side of our reddit interaction RPC protocol. It's a client
 * of Reddit, but a server from the point of view of our application!
 */
import { JSONRPCErrorException, JSONRPCServer } from "json-rpc-2.0";

import { SessionManager, createCachedSessionManager } from "./SessionManager";
import {
  createAddressOwnershipChallenge,
  getRedditAccountVaultAddresses,
  getRedditUserVaultAddress,
  registerAddressWithAccount,
} from "./api-client";
import { UserPageData } from "./page-data";
import {
  ErrorCode,
  RedditCreateAddressOwnershipChallenge,
  RedditGetAccountVaultAddresses,
  RedditGetUserProfile,
  RedditGetUserVaultAddress,
  RedditRegisterAddressWithAccount,
} from "./reddit-interaction-spec";

async function getUserSession(
  sessionManager: SessionManager,
  expectedUserId: string | null,
): Promise<UserPageData> {
  const pageData = await sessionManager.getPageData();
  if (!pageData.loggedIn) {
    throw new JSONRPCErrorException(
      "User is not logged in to the Reddit website",
      ErrorCode.USER_NOT_LOGGED_IN,
    );
  }
  if (expectedUserId !== null && expectedUserId !== pageData.user.userID) {
    // TODO: should we do something extra here? We could manage multiple
    // sessions, per-user. We could automatically try to re-auth with the
    // current reddit session.
    throw new JSONRPCErrorException(
      "Active session is not for the expected userId",
      ErrorCode.WRONG_USER,
    );
  }
  // Session can't be expired, getPageData() only returns unexpired sessions,
  // it re-fetches when they're expiring.
  return pageData;
}

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

  const sessionManager = createCachedSessionManager();

  service.addMethod(
    RedditGetUserProfile.name,
    RedditGetUserProfile.signature.implement(async (params) => {
      const session = await getUserSession(
        sessionManager,
        params?.userId ?? null,
      );
      return session.user;
    }),
  );
  service.addMethod(
    RedditCreateAddressOwnershipChallenge.name,
    RedditCreateAddressOwnershipChallenge.signature.implement(
      async (params) => {
        const session = await getUserSession(sessionManager, params.userId);
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
      const session = await getUserSession(sessionManager, params.userId);
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
      // This method does not depend on the logged-in user identity
      const session = await getUserSession(sessionManager, null);
      return (
        (await getRedditUserVaultAddress({
          authToken: session.auth.token,
          username: params.username,
        })) ?? null
      );
    }),
  );
  service.addMethod(
    RedditGetAccountVaultAddresses.name,
    RedditGetAccountVaultAddresses.signature.implement(async (params) => {
      const session = await getUserSession(sessionManager, params.userId);
      return await getRedditAccountVaultAddresses({
        authToken: session.auth.token,
      });
    }),
  );

  return service;
}
