import { useContext } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import { VaultonomyContext } from "./VaultonomyContext";
import { VaultonomyState } from "./createVaultonomyStore";

/**
 * Select multiple values from the store, as an array/object.
 *
 * The return value of selector is de-duplicated using shallow equality, so the
 * selector can create an object/array of multiple store values without always
 * triggering a re-render.
 */
export function useVaultonomyStore<T>(
  selector: (state: VaultonomyState) => T,
): T {
  return _useVaultonomyStore(selector, { shallow: true });
}

/**
 * Select a single value from the store.
 *
 * It's OK to select a single value which is itself an object/array etc, but
 * don't have the selector return a new object/array each call, as that would
 * make every call trigger a render. Use useVaultonomyStore() to select more
 * than one store value.
 */
export function useVaultonomyStoreSingle<T>(
  selector: (state: VaultonomyState) => T,
): T {
  return _useVaultonomyStore(selector, { shallow: false });
}

function _useVaultonomyStore<T>(
  selector: (state: VaultonomyState) => T,
  { shallow }: { shallow: boolean },
): T {
  const store = useContext(VaultonomyContext);
  if (!store)
    throw new Error(
      "No VaultonomyContext is available: VaultonomyContext.Provider must present as an ancestor of this element.",
    );
  return useStore(store, shallow ? useShallow(selector) : selector);
}
