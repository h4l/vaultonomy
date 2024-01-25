import { createContext } from "react";

import { VaultonomyStore } from "./createVaultonomyStore";

export const VaultonomyContext = createContext<VaultonomyStore | null>(null);
