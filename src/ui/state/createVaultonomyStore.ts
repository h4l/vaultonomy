import { Address } from "viem";
import { createStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { log } from "../../logging";
import { RedditEIP712Challenge } from "../../reddit/api-client";
import { RedditProvider } from "../../reddit/reddit-interaction-client";
import { HexString, RecursivePartial } from "../../types";
import { browser } from "../../webextension";
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
export type SentPairingMessage = Result<
  { messageHash: HexString },
  "message-expired" | "signature-invalid" | "request-failed"
>;

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
  setProvider(provider: VaultonomyBackgroundProvider): void;
  removeProvider(provider?: VaultonomyBackgroundProvider): void;
  setRedditProvider(redditProvider: RedditProvider): void;
  removeRedditProvider(redditProvider?: RedditProvider): void;
  onRedditLoggedOut(): void;
  onRedditNotLoggedOut(): void;
  updatePairingState(id: PairingId): UpdatePairingStateFunction;
  setPinnedPairing(pinnedPairing: PairingId | null): void;
  setPairingInterest(userInterest: UserInterest): void;
  setCurrentUserId(currentUserId: string | null): void;
  setSearchForUserQuery(rawQuery: string): void;
  setHasHydrated(hasHydrated: boolean): void;
  setLastScrollPosition(lastScrollPosition: number | null): void;
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

export type RedditProviderProblem = "not-connected" | "not-logged-in";

export type VaultonomyStateData = {
  hasHydrated: boolean;
  isOnDevServer: boolean;
  provider: VaultonomyBackgroundProvider | null;
  redditProvider: RedditProvider | null;
  redditWasLoggedOut: boolean | null;
  /** The userId of the most recently seen Reddit user profile. */
  currentUserId: string | null;
  /** Determines whether the pairing UI is collapsed or expanded. */
  pairingInterest: UserInterest | null;
  pairings: Partial<Record<string, PairingState>>;
  /** One of the pairings that has been signed and submitted to register the address. */
  pinnedPairing: PairingId | null;
  searchForUserQuery: string;
  lastScrollPosition: number | null;
};

type PersistedVaultonomyStateData = Pick<
  VaultonomyStateData,
  | "currentUserId"
  | "pairings"
  | "pairingInterest"
  | "pinnedPairing"
  | "searchForUserQuery"
  | "lastScrollPosition"
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
          hasHydrated: false,
          isOnDevServer,
          provider: provider ?? null,
          redditProvider: null,
          redditWasLoggedOut: null,
          currentUserId: null,
          pairingInterest: null,
          pairings: {},
          pinnedPairing: null,
          searchForUserQuery: "",
          lastScrollPosition: null,
          // actions
          setHasHydrated(hasHydrated: boolean): void {
            set({ hasHydrated });
          },
          setProvider(provider: VaultonomyBackgroundProvider): void {
            set((store) => {
              if (store.provider) {
                if (store.provider === provider) return store;
                log.warn(
                  "setProvider is replacing an existing provider",
                  store.provider,
                  provider,
                );
              }
              return { provider };
            });
          },
          removeProvider(provider?: VaultonomyBackgroundProvider): void {
            set((store) => {
              if (provider && store.provider && store.provider !== provider) {
                log.warn(
                  "removeProvider is not removing existing provider as it's not the expected value",
                  store.provider,
                  provider,
                );
                return store;
              }
              return { provider: null };
            });
          },
          setRedditProvider(redditProvider: RedditProvider): void {
            set((store) => {
              if (store.redditProvider) {
                if (store.redditProvider === redditProvider) return store;
                log.warn(
                  "setRedditProvider is replacing an existing redditProvider",
                  store.redditProvider,
                  redditProvider,
                );
              }
              return { redditProvider };
            });
          },
          removeRedditProvider(redditProvider?: RedditProvider): void {
            set((store) => {
              if (
                redditProvider &&
                store.redditProvider &&
                store.redditProvider !== redditProvider
              ) {
                log.warn(
                  "removeRedditProvider is not removing existing redditProvider as it's not the expected value",
                  store.redditProvider,
                  redditProvider,
                );
                return store;
              }
              return { redditProvider: null };
            });
          },
          onRedditLoggedOut() {
            set({ redditWasLoggedOut: true });
          },
          onRedditNotLoggedOut() {
            set({ redditWasLoggedOut: false });
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
          setPinnedPairing(pinnedPairing: PairingId | null): void {
            set({ pinnedPairing });
          },
          setCurrentUserId(currentUserId: string | null): void {
            set({ currentUserId });
          },
          setSearchForUserQuery(searchForUserQuery: string): void {
            set({ searchForUserQuery });
          },
          setLastScrollPosition(lastScrollPosition) {
            set({ lastScrollPosition });
          },
        };
        return state;
      },
      {
        name: "vaultonomy-ui-state",
        version: 5,
        partialize(store): PersistedVaultonomyStateData {
          return {
            currentUserId: store.currentUserId,
            pairings: store.pairings,
            pairingInterest: store.pairingInterest,
            pinnedPairing: store.pinnedPairing,
            searchForUserQuery: store.searchForUserQuery,
            lastScrollPosition: store.lastScrollPosition,
          };
        },
        onRehydrateStorage(_statePre) {
          return (statePost) => {
            statePost?.setHasHydrated(true);
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
