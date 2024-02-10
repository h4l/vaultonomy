import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { RedditEIP712Challenge } from "../../reddit/api-client";
import { HexString, RecursivePartial } from "../../types";
import { browser } from "../../webextension";
import { createVaultonomyBackgroundProvider } from "../hooks/createVaultonomyBackgroundProvider";
import { VaultonomyBackgroundProvider } from "../rpc/VaultonomyBackgroundProvider";
import { createExtensionStorage } from "./zustandExtensionStorage";

type UserInterest = "disinterested" | "interested";

export type Result<T, E = null> =
  | { result: "ok"; value: T; error?: undefined }
  | { result: "error"; error: E; value?: undefined };

export type FetchedPairingMessage = Result<RedditEIP712Challenge>;

type SignedPairingMessage = Result<
  HexString,
  "cancelled" | "sign-failed" | "signature-invalid"
>;

/**
 * Whether we have received a successful response to a address registration
 * request. The string value is an identifier for the challenge pairing message.
 */
type SentPairingMessage = Result<string>;

export type VaultonomyStateActions = {
  updateUser(userId: string): (userState: PartialUserState) => void;
  setPairingInterest(userInterest: UserInterest): void;
};

export enum PairingChecklist {
  madeBackup = "madeBackup",
  loadedBackup = "loadedBackup",
  testedBackup = "testedBackup",
}

export type UserState = {
  startPairingAttemptsBlocked: number;
  startPairingChecklist: Record<PairingChecklist, boolean>;
  fetchedPairingMessage: FetchedPairingMessage | null;
  signedPairingMessage: SignedPairingMessage | null;
  sentPairingMessage: SentPairingMessage | null;
};

export type PartialUserState = RecursivePartial<UserState>;

export type VaultonomyStateData = {
  isOnDevServer: boolean;
  provider: VaultonomyBackgroundProvider;

  /** Determines whether the pairing UI is collapsed or expanded. */
  pairingInterest: UserInterest | null;
  users: Partial<Record<string, UserState>>;
};

type PersistedVaultonomyStateData = Pick<
  VaultonomyStateData,
  "users" | "pairingInterest"
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
      (set) => {
        const state: VaultonomyState = {
          isOnDevServer,
          provider:
            provider ??
            createVaultonomyBackgroundProvider({
              isOnDevServer: isOnDevServer,
            }),
          pairingInterest: null,
          users: {},
          // actions
          setPairingInterest(pairingInterest: UserInterest): void {
            set((store) => ({ ...store, pairingInterest }));
          },
          updateUser(userId: string) {
            return (update: PartialUserState) => {
              set((store) => {
                const updatedUser: UserState = mergePartialUser(
                  store.users[userId] ?? emptyUser(),
                  update,
                );
                return {
                  ...store,
                  users: { ...store.users, [userId]: updatedUser },
                };
              });
            };
          },
        };
        return state;
      },
      {
        name: "vaultonomy-ui-state",
        version: 1,
        partialize(store): PersistedVaultonomyStateData {
          return { users: store.users, pairingInterest: store.pairingInterest };
        },
        storage:
          isOnDevServer ?
            createJSONStorage(() => window.sessionStorage)
          : createExtensionStorage(browser.storage.session),
      },
    ),
  );
};

export function mergePartialUser(
  user: UserState,
  update: PartialUserState,
): UserState {
  return {
    ...user,
    ...update,
    ...{
      startPairingChecklist: {
        ...user.startPairingChecklist,
        ...definedProperties(update.startPairingChecklist),
      },
    },
  };
}

function definedProperties<T extends Record<string | number | symbol, unknown>>(
  obj?: T,
): Partial<T> {
  return obj ?
      (Object.fromEntries(
        Object.entries(obj).filter(([_k, v]) => v !== undefined),
      ) as Partial<T>)
    : {};
}

export function emptyUser(): UserState {
  return {
    startPairingAttemptsBlocked: 0,
    startPairingChecklist: {
      madeBackup: false,
      loadedBackup: false,
      testedBackup: false,
    },
    fetchedPairingMessage: null,
    signedPairingMessage: null,
    sentPairingMessage: null,
  };
}
