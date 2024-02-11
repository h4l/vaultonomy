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

const LOGGED_OUT_LIFETIME = 1000;
const MIN_SESSION_LENGTH = 1000 * 60 * 10;

// TODO: we should clear the user session cache when a non-cached request sees a
// logged-out user, otherwise we'll hold onto credentials after logout.

async function getUserSession(
  sessionManager: SessionManager,
  expectedUserId: string | null,
): Promise<UserPageData> {
  const pageData = await sessionManager.getPageData(
    // When not requesting the session for a specific user, we revalidate the
    // current session by requesting the live page data, bypassing the cache.
    // Allow these responses to be cached in-memory for 1s to avoid duplicate requests.
    expectedUserId === null ?
      { maxAge: LOGGED_OUT_LIFETIME }
      // When fetching a session for a known user, just require that there's a
      // reasonable amount of session length remaining on their auth token.
    : { minFresh: MIN_SESSION_LENGTH },
  );
  // We don't cache logged-out responses, so this will be an up-to-date result
  if (!pageData.loggedIn) {
    throw new JSONRPCErrorException(
      "User is not logged in to the Reddit website",
      ErrorCode.USER_NOT_LOGGED_IN,
    );
  }

  if (expectedUserId !== null && expectedUserId !== pageData.user.userID) {
    // The UI is responsible for handling this situation.
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
