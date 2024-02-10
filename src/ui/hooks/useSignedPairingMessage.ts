import { useVaultonomyStoreUser } from "../state/useVaultonomyStoreUser";

export function useSignedPairingMessage(userId: string | undefined) {
  return useVaultonomyStoreUser(
    userId,
    ({ user }) => user.signedPairingMessage,
  );
}
