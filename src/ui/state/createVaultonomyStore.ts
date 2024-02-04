import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { RedditEIP712Challenge } from "../../reddit/api-client";
import { HexString } from "../../types";
import { browser } from "../../webextension";
import { createVaultonomyBackgroundProvider } from "../hooks/createVaultonomyBackgroundProvider";
import { VaultonomyBackgroundProvider } from "../rpc/VaultonomyBackgroundProvider";
import { createExtensionStorage } from "./zustandExtensionStorage";

type UserInterest = "disinterested" | "interested";

export type Result<T, E = null> =
  | { result: "ok"; value: T; error?: undefined }
  | { result: "error"; error: E; value: undefined };

export type FetchedPairingMessage = Result<RedditEIP712Challenge>;

type SignedPairingMessage = Result<HexString>;

/**
 * Whether we have received a successful response to a address registration
 * request. The string value is an identifier for the challenge pairing message.
 */
type SentPairingMessage = Result<string>;

export type VaultonomyStateActions = {
  expressInterestInPairing: () => void;
  expressDisinterestInPairing: () => void;
};

export type VaultonomyStateData = {
  isOnDevServer: boolean;
  provider: VaultonomyBackgroundProvider;
  /** Determines whether the pairing UI is collapsed or expanded. */
  pairing_UserInterest: UserInterest | null;
  pairing_FetchedPairingMessage: FetchedPairingMessage | null;
  pairing_SignedPairingMessage: SignedPairingMessage | null;
  pairing_SentPairingMessage: SentPairingMessage | null;
};

type PersistedVaultonomyStateData = Pick<
  VaultonomyStateData,
  | "pairing_UserInterest"
  | "pairing_FetchedPairingMessage"
  | "pairing_SignedPairingMessage"
  | "pairing_SentPairingMessage"
>;

export type VaultonomyState = VaultonomyStateData & VaultonomyStateActions;

export type VaultonomyParams = Pick<
  VaultonomyState,
  "isOnDevServer" | "provider"
>;

export type VaultonomyStore = ReturnType<typeof createVaultonomyStore>;

export const createVaultonomyStore = (
  initProps: Partial<VaultonomyParams> = {},
) => {
  const { isOnDevServer = true, provider } = initProps;

  return createStore<VaultonomyState>()(
    persist(
      (set) => ({
        isOnDevServer,
        provider:
          provider ??
          createVaultonomyBackgroundProvider({ isOnDevServer: isOnDevServer }),
        pairing_UserInterest: null,
        pairing_FetchedPairingMessage: null,
        pairing_SignedPairingMessage: null,
        pairing_SentPairingMessage: null,
        expressInterestInPairing: () =>
          set({ pairing_UserInterest: "interested" }),
        expressDisinterestInPairing: () =>
          set({ pairing_UserInterest: "disinterested" }),
      }),
      {
        name: "vaultonomy-ui-state",
        partialize(s): PersistedVaultonomyStateData {
          return {
            pairing_UserInterest: s.pairing_UserInterest,
            pairing_FetchedPairingMessage: s.pairing_FetchedPairingMessage,
            pairing_SignedPairingMessage: s.pairing_SignedPairingMessage,
            pairing_SentPairingMessage: s.pairing_SentPairingMessage,
          };
        },
        storage:
          isOnDevServer ?
            createJSONStorage(() => window.sessionStorage)
          : createExtensionStorage(browser.storage.session),
      },
    ),
  );
};
