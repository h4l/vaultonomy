import { createStore } from "zustand";

import { createVaultonomyBackgroundProvider } from "../hooks/createVaultonomyBackgroundProvider";
import { VaultonomyBackgroundProvider } from "../rpc/VaultonomyBackgroundProvider";

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

  return createStore<VaultonomyState>()((set) => ({
    isOnDevServer,
    provider:
      provider ??
      createVaultonomyBackgroundProvider({ isOnDevServer: isOnDevServer }),
    intendedPairingState: { userState: "disinterested" },
    expressInterestInPairing: () =>
      set({ intendedPairingState: { userState: "interested" } }),
    expressDisinterestInPairing: () =>
      set({ intendedPairingState: { userState: "disinterested" } }),
  }));
};
