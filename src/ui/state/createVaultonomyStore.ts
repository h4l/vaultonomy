import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { browser } from "../../webextension";
import { createVaultonomyBackgroundProvider } from "../hooks/createVaultonomyBackgroundProvider";
import { VaultonomyBackgroundProvider } from "../rpc/VaultonomyBackgroundProvider";
import { createExtensionStorage } from "./zustandExtensionStorage";

type PairingState =
  | { userState: "disinterested" }
  | { userState: "interested" };

export type VaultonomyStateActions = {
  expressInterestInPairing: () => void;
  expressDisinterestInPairing: () => void;
};

export type VaultonomyStateData = {
  isOnDevServer: boolean;
  provider: VaultonomyBackgroundProvider;
  intendedPairingState: PairingState;
};

type PersistedVaultonomyStateData = Pick<
  VaultonomyStateData,
  "intendedPairingState"
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
        intendedPairingState: { userState: "disinterested" },
        expressInterestInPairing: () =>
          set({ intendedPairingState: { userState: "interested" } }),
        expressDisinterestInPairing: () =>
          set({ intendedPairingState: { userState: "disinterested" } }),
      }),
      {
        name: "vaultonomy-ui-state",
        partialize({ intendedPairingState }): PersistedVaultonomyStateData {
          return { intendedPairingState };
        },
        storage:
          isOnDevServer ?
            createJSONStorage(() => window.sessionStorage)
          : createExtensionStorage(browser.storage.session),
      },
    ),
  );
};
