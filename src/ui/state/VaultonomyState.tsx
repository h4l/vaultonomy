import { Emitter, createNanoEvents } from "nanoevents";
import {
  ReactNode,
  createContext,
  useEffect,
  useReducer,
  useState,
} from "react";

import { assert, assertUnreachable } from "../../assert";
import {
  AccountVaultAddress,
  RedditProvider,
  RedditProviderError,
} from "../../reddit/reddit-interaction-client";
import { RedditUserProfile } from "../../reddit/reddit-interaction-spec";
import { VaultonomyBackgroundProvider } from "../rpc/VaultonomyBackgroundProvider";
import { getIncreasingId } from "./increasing-ids";
import { useVaultonomyBackgroundProvider } from "./useVaultonomyBackgroundProvider";

type DispatchFn = (action: VaultonomyAction) => void;

type PairingState =
  | { userState: "disinterested" }
  | { userState: "interested" };

// redditTabNotAvailable — contentscript not running in any Reddit tab
// redditTabAvailable — contentscript running in a Reddit tab, and we have the tabId from the backend
// redditTabConnecting — we are connecting to the reddit tab
// redditTabConnected — we have established communication with the Reddit tab

// Send one-shot message to get tab ID
// Backend publishes availability of tab ID when connected

type AsyncValue<T> =
  | { state: "loading" | "failed"; id: number }
  | { state: "loaded"; value: T; id: number };

type RedditState = TabAvailableRedditState | TabNotAvailableRedditState;
type TabNotAvailableRedditState = { state: "tabNotAvailable" };
type TabAvailableRedditState = {
  state: "tabAvailable";
  userProfile?: AsyncValue<RedditUserProfile>;
  vaultAddresses?: AsyncValue<ReadonlyArray<AccountVaultAddress>>;
  // TODO: add other states for Reddit Data
};

export interface VaultonomyState {
  intendedPairingState: PairingState;
  redditState: RedditState;
}

interface UserExpressedInterestInPairingAction {
  type: "userExpressedInterestInPairing";
}

interface RedditTabBecameAvailableAction {
  type: "redditTabBecameAvailable";
}
interface RedditTabBecameUnavailableAction {
  type: "redditTabBecameUnavailable";
}

type AsyncValueLoadActions<N extends string, T> = {
  type: N;
} & AsyncValue<T>;

type RedditProfileAvailabilityChangedActions = AsyncValueLoadActions<
  "redditProfileAvailabilityChanged",
  RedditUserProfile
>;
type RedditVaultsAvailabilityChangedActions = AsyncValueLoadActions<
  "redditVaultsAvailabilityChanged",
  Array<AccountVaultAddress>
>;

type VaultonomyAction =
  | UserExpressedInterestInPairingAction
  | RedditTabBecameAvailableAction
  | RedditTabBecameUnavailableAction
  | RedditProfileAvailabilityChangedActions
  | RedditVaultsAvailabilityChangedActions;

export function vaultonomyStateReducer(
  vaultonomy: VaultonomyState,
  action: VaultonomyAction,
): VaultonomyState {
  switch (action.type) {
    case "userExpressedInterestInPairing": {
      return {
        ...vaultonomy,
        intendedPairingState: { userState: "interested" },
      };
    }
    case "redditTabBecameUnavailable": {
      if (vaultonomy.redditState.state === "tabNotAvailable") {
        return vaultonomy;
      }
      return { ...vaultonomy, redditState: { state: "tabNotAvailable" } };
    }
    case "redditTabBecameAvailable": {
      if (vaultonomy.redditState.state === "tabAvailable") {
        return vaultonomy;
      }
      return { ...vaultonomy, redditState: { state: "tabAvailable" } };
    }
    case "redditProfileAvailabilityChanged": {
      if (vaultonomy.redditState.state === "tabNotAvailable") return vaultonomy;
      if ((vaultonomy.redditState.userProfile?.id ?? 0) > action.id)
        return vaultonomy;
      return {
        ...vaultonomy,
        redditState: { ...vaultonomy.redditState, userProfile: action },
      };
    }
    case "redditVaultsAvailabilityChanged": {
      if (vaultonomy.redditState.state === "tabNotAvailable") return vaultonomy;
      if ((vaultonomy.redditState.vaultAddresses?.id ?? 0) > action.id)
        return vaultonomy;
      return {
        ...vaultonomy,
        redditState: { ...vaultonomy.redditState, vaultAddresses: action },
      };
    }
  }
  assertUnreachable(action);
}

function defaultVaultonomyState(): VaultonomyState {
  return {
    intendedPairingState: { userState: "disinterested" },
    redditState: { state: "tabNotAvailable" },
  };
}

function defaultDispatch(): never {
  assert(
    false,
    "defaultVaultonomyState().dispatch(...) unexpectedly called: this " +
      "VaultonomyState should have been replaced with the return value of useRootVaultonomyState()",
  );
}

export const VaultonomyStateContext = createContext<
  [VaultonomyState, DispatchFn]
>([defaultVaultonomyState(), defaultDispatch]);

export function useRootVaultonomyState(): [VaultonomyState, DispatchFn] {
  return useReducer(vaultonomyStateReducer, undefined, defaultVaultonomyState);
}

type AsyncDriverEvents = {
  stopped: () => void;
};

abstract class AsyncDriver<State = any, Action = any> {
  #stopped: boolean = false;
  emitter: Emitter<AsyncDriverEvents> = createNanoEvents();
  private runningReconciliation?: Promise<void>;

  async reconcile(state: State, dispatch: (action: Action) => void) {
    if (this.runningReconciliation !== undefined) {
      throw new Error(
        "reconcile called with an existing runningReconciliation",
      );
    }
    this.runningReconciliation = this.doReconcile(state, dispatch);
    try {
      return await this.runningReconciliation;
    } finally {
      this.runningReconciliation = undefined;
    }
  }

  async idle(): Promise<void> {
    try {
      await this.runningReconciliation;
    } catch (e) {
      console.error(
        "AsyncDriver.idle(): runningReconciliation failed while being awaited",
        e,
      );
    }
  }

  protected abstract doReconcile(
    state: State,
    dispatch: (action: Action) => void,
  ): Promise<void>;

  get stopped(): boolean {
    return this.#stopped;
  }

  stop(): void {
    this.#stopped = true;
    this.emitter.emit("stopped");
  }
}

function useDriveAsync<S, A, T extends AsyncDriver<S, A>>({
  initializer,
  state,
  dispatch,
  getDependencies,
}: {
  initializer: () => T;
  state: S;
  dispatch: (action: A) => void;
  getDependencies?: (state: S) => unknown[];
}) {
  const [asyncDriver, setAsyncDriver] = useState<T>();

  useEffect(() => {
    const createdAsyncDriver = initializer();
    setAsyncDriver(createdAsyncDriver);
    return () => createdAsyncDriver.stop();
  }, []);

  useEffect(() => {
    if (!asyncDriver) return;
    let cancelled = false;

    // Ensure only one reconcile runs at a time
    (async () => {
      if (cancelled) return;
      await asyncDriver.idle();
      if (!cancelled) {
        asyncDriver.reconcile(state, dispatch);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [asyncDriver, ...(getDependencies ? getDependencies(state) : [])]);
}

interface VaultonomyBackgroundProviderDriverState {
  vaultonomy: VaultonomyState;
  provider: VaultonomyBackgroundProvider | undefined;
}

type Unbind = () => void;

class VaultonomyBackgroundProviderDriver extends AsyncDriver<
  VaultonomyBackgroundProviderDriverState,
  VaultonomyAction
> {
  private provider?: VaultonomyBackgroundProvider;
  private unbindProvider?: Unbind;
  private redditProvider?: RedditProvider;
  private loadingProfile?: Promise<RedditUserProfile>;
  private loadingVaultAddresses?: Promise<Array<AccountVaultAddress>>;

  static getDependencies({
    vaultonomy: { redditState },
    provider,
  }: VaultonomyBackgroundProviderDriverState): unknown[] {
    return [redditState, provider];
  }

  protected doCancel(): void {}

  protected async doReconcile(
    {
      vaultonomy: { redditState: _redditState },
      provider,
    }: VaultonomyBackgroundProviderDriverState,
    dispatch: DispatchFn,
  ): Promise<void> {
    // Reset loading state when provider changes or becomes unavailable
    if (this.provider !== provider) {
      if (this.unbindProvider) this.unbindProvider();
      this.provider = provider;
      this.unbindProvider = provider?.emitter.on(
        "availabilityStatus",
        (event) => {
          switch (event.type) {
            case "redditTabBecameAvailable":
              this.redditProvider = event.redditProvider;
              dispatch({ type: "redditTabBecameAvailable" });
              break;
            case "redditTabBecameUnavailable":
              this.redditProvider = undefined;
              dispatch({ type: "redditTabBecameUnavailable" });
              break;
            default:
              assertUnreachable(event);
          }
        },
      );
      this.loadingProfile = undefined;
      this.loadingVaultAddresses = undefined;
      await provider?.requestAvailabilityStatus();
    }
    const redditProvider = this.redditProvider;

    if (provider === undefined || redditProvider === undefined) {
      return;
    }

    if (!this.loadingProfile) {
      this.loadingProfile = dispatchAsyncValueLoadActions({
        type: "redditProfileAvailabilityChanged",
        asyncValue: retry({
          action: async () => await redditProvider.getUserProfile(),
          canRetry: oneRedditProviderError,
        }),
        dispatch,
      });
    }

    if (!this.loadingVaultAddresses) {
      this.loadingVaultAddresses = dispatchAsyncValueLoadActions({
        type: "redditVaultsAvailabilityChanged",
        asyncValue: retry({
          action: async () => await redditProvider.getAccountVaultAddresses(),
          canRetry: oneRedditProviderError,
        }),
        dispatch,
      });
    }
  }
}

async function dispatchAsyncValueLoadActions<N extends string, T>({
  type,
  asyncValue,
  dispatch,
}: {
  type: N;
  asyncValue: Promise<T>;
  dispatch: (action: AsyncValueLoadActions<N, T>) => void;
}): Promise<T> {
  const id = getIncreasingId();
  try {
    dispatch({ type, id, state: "loading" });
    const value = await asyncValue;
    dispatch({ type, id, state: "loaded", value });
    return value;
  } catch (error) {
    dispatch({ type, id, state: "failed" });
    throw error;
  }
}

const oneRedditProviderError: RetryPredicate = (error, attempt) =>
  attempt == 1 && error instanceof RedditProviderError;

type RetryPredicate = (error: unknown, attempt: number) => boolean;

async function retry<T>({
  action,
  canRetry: retryWhile,
}: {
  action: () => Promise<T>;
  canRetry: RetryPredicate;
}): Promise<T> {
  for (let attempt = 1; ; ++attempt) {
    try {
      return await action();
    } catch (error) {
      if (retryWhile(error, attempt)) {
        continue;
      }
      throw error;
    }
  }
}

export function VaultonomyRoot({
  children,
}: {
  children?: ReactNode;
}): JSX.Element {
  const [vaultonomy, dispatch] = useRootVaultonomyState();

  const vaultonomyBackgroundProvider = useVaultonomyBackgroundProvider();

  useDriveAsync({
    initializer: () => new VaultonomyBackgroundProviderDriver(),
    state: { vaultonomy, provider: vaultonomyBackgroundProvider },
    dispatch,
    getDependencies: VaultonomyBackgroundProviderDriver.getDependencies,
  });

  return (
    <VaultonomyStateContext.Provider value={[vaultonomy, dispatch]}>
      {children}
    </VaultonomyStateContext.Provider>
  );
}
