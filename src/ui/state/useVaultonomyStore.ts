import { useContext } from "react";
import { useStore } from "zustand";

import { VaultonomyContext } from "./VaultonomyContext";
import { VaultonomyState } from "./createVaultonomyStore";

export function useVaultonomyStore<T>(
  selector: (state: VaultonomyState) => T,
): T {
  const store = useContext(VaultonomyContext);
  if (!store)
    throw new Error(
      "No VaultonomyContext is available: VaultonomyContext.Provider must present as an ancestor of this element.",
    );
  return useStore(store, selector);
}
