import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import {
  VaultonomyStore,
  createVaultonomyStore,
} from "./state/createVaultonomyStore";
import { useStoreCurrentUserId } from "./state/useStoreCurrentUserId";

const queryClient = new QueryClient();

export function App({ vaultonomyStore }: { vaultonomyStore: VaultonomyStore }) {
  return (
    <AppContext vaultonomyStore={vaultonomyStore}>
      <AppUI />
    </AppContext>
  );
}

export function AppContext({
  vaultonomyStore,
  children,
}: {
  vaultonomyStore: VaultonomyStore;
  children?: ReactNode;
}) {
  return (
    // We need WagmiProvider at the root to make sure it doesn't get re-rendered
    // as a result of app state changes. If it re-renders it triggers this bug:
    // https://github.com/wevm/wagmi/issues/3611
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <VaultonomyContext.Provider value={vaultonomyStore}>
          <HelpProvider>{children}</HelpProvider>
        </VaultonomyContext.Provider>
      </QueryClientProvider>
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
      <hr
        aria-hidden="true"
        className="snap-start scroll-p-52 invisible border-none"
      />
      <TopBanner />
      <UserSearch />
      <hr
        aria-hidden="true"
        className="snap-start scroll-p-52 invisible border-none"
      />
      <header className="pt-32 pb-16 w-72 max-w-full mx-auto">
        <VaultonomyLogo className="" />
      </header>
      <main className="flex flex-col gap-20">
        <UserProfile
          profile={
            redditAccount.isRedditAvailable ? redditAccount.data : undefined
          }
          // <UserProfile
          //   profile={{
          //     hasPremium: true,
          //     userID: "abc123",
          //     username: "h4l",
          //     accountIconURL:
          //       "https://i.redd.it/snoovatar/avatars/nftv2_bmZ0X2VpcDE1NToxMzdfOWQ4NTQyZWYxMjM3OTMzYmFkYmU4NjcyOTFmNmMwNDM0YjhkMzE1Y18yNzEz_rare_0411a65f-b673-43bf-ae65-b7cc7c9349a2.png",
          //   }}
        />

        <div className="mx-10 flex flex-row flex-wrap justify-center gap-x-40 gap-y-20">
          <Vault activeVault={activeVault} />
          <Wallet wallet={wallet} />
        </div>

        <Pairing
          redditAccount={redditAccount}
          activeVault={activeVault}
          wallet={wallet}
        />

        {/* <UserAvatar avatarUrl="https://i.redd.it/snoovatar/avatars/nftv2_bmZ0X2VpcDE1NToxMzdfOWQ4NTQyZWYxMjM3OTMzYmFkYmU4NjcyOTFmNmMwNDM0YjhkMzE1Y18yNzEz_rare_0411a65f-b673-43bf-ae65-b7cc7c9349a2.png" />
        <UserAvatar avatarUrl="https://i.redd.it/snoovatar/avatars/7d436c39-b6be-4e4b-8d42-5c51562e1095.png" /> */}

        <PastVaults userId={userId} />
      </main>
      <Footer />

      <HelpDialog />
    </>
  );
}
