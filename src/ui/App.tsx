import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  PersistQueryClientProvider,
  Persister,
} from "@tanstack/react-query-persist-client";
import { ReactNode } from "react";
import { WagmiProvider, useAccount } from "wagmi";

import { wagmiConfig } from "../wagmi";
import { Footer } from "./Footer";
import { HelpDialog, HelpProvider } from "./Help";
import { Pairing } from "./Pairing";
import { PastVaults } from "./PastVaults";
import { TopBanner } from "./TopBanner";
import { UserProfile } from "./UserProfile";
import { UserSearch } from "./UserSearch";
import { Vault } from "./Vault";
import { VaultonomyLogo } from "./VaultonomyLogo";
import { Wallet } from "./Wallet";
import { useRedditAccount } from "./hooks/useRedditAccount";
import { useRedditAccountActiveVault } from "./hooks/useRedditAccountVaults";
import { useVaultonomyBackgroundConnection } from "./hooks/useVaultonomyBackgroundProvider";
import { VaultonomyContext } from "./state/VaultonomyContext";
import { VaultonomyStore } from "./state/createVaultonomyStore";
import { useStoreCurrentUserId } from "./state/useStoreCurrentUserId";

export function App({
  queryClient,
  queryClientPersister,
  vaultonomyStore,
}: {
  queryClient: QueryClient;
  queryClientPersister: Persister;
  vaultonomyStore: VaultonomyStore;
}) {
  return (
    <AppContext
      vaultonomyStore={vaultonomyStore}
      queryClient={queryClient}
      queryClientPersister={queryClientPersister}
    >
      <AppUI />
    </AppContext>
  );
}

export function AppContext({
  vaultonomyStore,
  queryClient,
  queryClientPersister,
  children,
}: {
  vaultonomyStore: VaultonomyStore;
  queryClient: QueryClient;
  queryClientPersister: Persister;
  children?: ReactNode;
}) {
  return (
    // We need WagmiProvider at the root to make sure it doesn't get re-rendered
    // as a result of app state changes. If it re-renders it triggers this bug:
    // https://github.com/wevm/wagmi/issues/3611
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryClientPersister }}
      >
        <QueryClientProvider client={queryClient}>
          <VaultonomyContext.Provider value={vaultonomyStore}>
            <HelpProvider>{children}</HelpProvider>
          </VaultonomyContext.Provider>
        </QueryClientProvider>
      </PersistQueryClientProvider>
    </WagmiProvider>
  );
}

export function AppUI() {
  useVaultonomyBackgroundConnection();
  const redditAccount = useRedditAccount();
  useStoreCurrentUserId(redditAccount);
  const userId = redditAccount.data?.userID;
  const activeVault = useRedditAccountActiveVault({ userId });
  const wallet = useAccount();

  return (
    <>
      <TopBanner />
      <UserSearch />
      <header className="pt-32 pb-16 w-72 max-w-full mx-auto">
        <VaultonomyLogo className="" />
      </header>
      <main className="flex flex-col gap-20">
        <UserProfile profile={redditAccount.data} />

        <div className="mx-10 flex flex-row flex-wrap justify-center gap-x-40 gap-y-20">
          <Vault activeVault={activeVault} />
          <Wallet wallet={wallet} />
        </div>

        <Pairing
          redditAccount={redditAccount}
          activeVault={activeVault}
          wallet={wallet}
        />

        <PastVaults userId={userId} />
      </main>
      <Footer />

      <HelpDialog />
    </>
  );
}
