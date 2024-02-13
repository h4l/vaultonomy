import { Address } from "viem";
import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { AssertionError, assert } from "../../assert";
import { RedditEIP712Challenge } from "../../reddit/api-client";
import { RedditProvider } from "../../reddit/reddit-interaction-client";
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

export type SignedPairingMessage = Result<
  HexString,
  "user-cancelled" | "wallet-cancelled" | "sign-failed" | "signature-invalid"
>;

/**
 * Whether we have received a successful response to a address registration
 * request. The string value is an identifier for the challenge pairing message.
 */
type SentPairingMessage = Result<string>;

export type PairingId = {
  userId: string;
  vaultAddress: Address | null;
  walletAddress: Address;
};
export type UpdatePairingStateFunction = (
  pairingState: PartialPairingState,
) => void;

export type VaultonomyStateActions = {
  /**
   * Set or remove the current provider.
   *
   * An existing provider cannot be overwritten by this call — the provider must
   * be set to null before setting a new one. This is to prevent accidentally
   * loosing a reference to a provider with an open Port connection.
   */
  setProvider(provider: VaultonomyBackgroundProvider | null): void;
  setRedditProvider(redditProvider: RedditProvider | null): void;
  updatePairingState(id: PairingId): UpdatePairingStateFunction;
  setPairingInterest(userInterest: UserInterest): void;
  setCurrentUserId(currentUserId: string | null): void;
};

export enum PairingChecklist {
  madeBackup = "madeBackup",
  loadedBackup = "loadedBackup",
  testedBackup = "testedBackup",
}

export type PairingState = {
  startPairingAttemptsBlocked: number;
  startPairingChecklist: Record<PairingChecklist, boolean>;
  fetchedPairingMessage: FetchedPairingMessage | null;
  signedPairingMessage: SignedPairingMessage | null;
  sentPairingMessage: SentPairingMessage | null;
};

export type PartialPairingState = RecursivePartial<PairingState>;

export type VaultonomyStateData = {
  isOnDevServer: boolean;
  provider: VaultonomyBackgroundProvider | null;
  redditProvider: RedditProvider | null;
  /** The userId of the most recently seen Reddit user profile. */
  currentUserId: string | null;
  /** Determines whether the pairing UI is collapsed or expanded. */
  pairingInterest: UserInterest | null;
  pairings: Partial<Record<string, PairingState>>;
};

type PersistedVaultonomyStateData = Pick<
  VaultonomyStateData,
  "currentUserId" | "pairings" | "pairingInterest"
>;

export type VaultonomyState = VaultonomyStateData & VaultonomyStateActions;

export type VaultonomyParams = Pick<
  VaultonomyState,
  "isOnDevServer" | "provider"
>;

export type VaultonomyStore = ReturnType<typeof createVaultonomyStore>;

export function encodePairingStateKey({
  userId,
  vaultAddress,
  walletAddress,
}: PairingId): string {
  // none of these can contain commas
  return `${userId}:${vaultAddress}:${walletAddress}`;
}

export const createVaultonomyStore = (
  initProps: Partial<VaultonomyParams> = {},
) => {
  const { isOnDevServer = true, provider } = initProps;

  return createStore<VaultonomyState>()(
    persist(
      (set) => {
        const state: VaultonomyState = {
          isOnDevServer,
          provider: provider ?? null,
          redditProvider: null,
          currentUserId: null,
          pairingInterest: null,
          pairings: {},
          // actions
          setProvider(provider: VaultonomyBackgroundProvider | null): void {
            set((store) => {
              assert(
                !(provider && store.provider),
                "attempted to replace an existing provider with a new provider",
              );
              return { provider };
            });
          },
          setRedditProvider(redditProvider: RedditProvider | null): void {
            set((store) => {
              assert(
                !(redditProvider && store.redditProvider),
                "attempted to replace an existing redditProvider with a new redditProvider",
              );
              return { redditProvider };
            });
          },
          setPairingInterest(pairingInterest: UserInterest): void {
            set((store) => ({ ...store, pairingInterest }));
          },
          updatePairingState(id) {
            return (update: PartialPairingState) => {
              const key = encodePairingStateKey(id);
              set((store) => {
                const updatedState: PairingState = mergePartialPairingState(
                  store.pairings[key] ?? emptyPairingState(),
                  update,
                );
                return {
                  ...store,
                  pairings: { ...store.pairings, [key]: updatedState },
                };
              });
            };
          },
          setCurrentUserId(currentUserId: string | null): void {
            set({ currentUserId });
          },
        };
        return state;
      },
      {
        name: "vaultonomy-ui-state",
        version: 2,
        partialize(store): PersistedVaultonomyStateData {
          return {
            currentUserId: store.currentUserId,
            pairings: store.pairings,
            pairingInterest: store.pairingInterest,
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

export function mergePartialPairingState(
  pairing: PairingState,
  update: PartialPairingState,
): PairingState {
  return {
    ...pairing,
    ...update,
    ...{
      startPairingChecklist: {
        ...pairing.startPairingChecklist,
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

export function emptyPairingState(): PairingState {
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
