import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useRef } from "react";
import { WagmiProvider } from "wagmi";

import { wagmiConfig } from "../wagmi";
import { HelpContext, HelpModal, useRootHelpState } from "./Help";
import { Pairing } from "./Pairing";
import { UserProfile } from "./UserProfile";
import { Vault } from "./Vault";
import { VaultonomyLogo } from "./VaultonomyLogo";
import { Wallet } from "./Wallet";
import { useRedditAccount } from "./hooks/useRedditAccount";
import { useRedditAccountActiveVault } from "./hooks/useRedditAccountActiveVault";
import { VaultonomyContext } from "./state/VaultonomyContext";
import { createVaultonomyStore } from "./state/createVaultonomyStore";
import { useStoreCurrentUserId } from "./state/useStoreCurrentUserId";

const queryClient = new QueryClient();

export function App() {
  return (
    <AppContext>
      <AppUI />
    </AppContext>
  );
}

export function AppContext({
  isOnDevServer,
  children,
}: {
  isOnDevServer?: boolean;
  children?: ReactNode;
} = {}) {
  const help = useRootHelpState();
  const store = useRef(createVaultonomyStore({ isOnDevServer })).current;

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <VaultonomyContext.Provider value={store}>
          <HelpContext.Provider value={help}>{children}</HelpContext.Provider>
        </VaultonomyContext.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function AppUI() {
  const redditAccount = useRedditAccount();
  useStoreCurrentUserId(redditAccount);
  const userId = redditAccount.data?.userID;
  const activeVault = useRedditAccountActiveVault({ userId });
  const wallet = useAccount();

  return (
    <>
      <header className="mt-32 mb-16 w-72 max-w-full mx-auto">
        <VaultonomyLogo className="" />
      </header>
      <main>
        <UserProfile
          profile={
            userProfile.isRedditAvailable ?
              userProfile.data?.profile
            : undefined
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

        <div className="m-10 flex flex-row flex-wrap justify-center gap-x-40 gap-y-20">
          <Vault userId={userProfile.data?.profile?.userID} />
          <Wallet />
        </div>

        <Pairing
          userProfile={userProfile.data?.profile}
          activeVault={activeVault}
        />

        {/* <UserAvatar avatarUrl="https://i.redd.it/snoovatar/avatars/nftv2_bmZ0X2VpcDE1NToxMzdfOWQ4NTQyZWYxMjM3OTMzYmFkYmU4NjcyOTFmNmMwNDM0YjhkMzE1Y18yNzEz_rare_0411a65f-b673-43bf-ae65-b7cc7c9349a2.png" />
        <UserAvatar avatarUrl="https://i.redd.it/snoovatar/avatars/7d436c39-b6be-4e4b-8d42-5c51562e1095.png" /> */}
      </main>

      <HelpModal />
    </>
  );
}
