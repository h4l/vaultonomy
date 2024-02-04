import { RedditEIP712Challenge } from "../../reddit/api-client";
import { FetchedPairingMessage } from "../state/createVaultonomyStore";
import { useVaultonomyStore } from "../state/useVaultonomyStore";

export function usePairingMessage(): FetchedPairingMessage | null {
  const lastFetchedPairingMessage = useVaultonomyStore(
    (s) => s.pairing_FetchedPairingMessage,
  );

  // TODO: this should be pure, so handle expiry by explicitly changing the
  // store state. We'll also detect expiry before signing/sending.
  // if (
  //   lastFetchedPairingMessage?.value &&
  //   isExpired(lastFetchedPairingMessage.value)
  // )
  //   return null;
  return lastFetchedPairingMessage;
}

export function isExpired(pairingMsg: RedditEIP712Challenge): boolean {
  const expiry = new Date(pairingMsg.message.expiresAt);
  return expiry.getTime() < Date.now();
}
