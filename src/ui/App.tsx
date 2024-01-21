import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useContext } from "react";
import { WagmiProvider } from "wagmi";

import { DevServerContext } from "../devserver/DevServerContext";
import { wagmiConfig } from "../wagmi";
import { HelpContext, HelpModal, useRootHelpState } from "./Help";
import { Pairing } from "./Pairing";
import { UserProfile } from "./UserProfile";
import { Vault } from "./Vault";
import { VaultonomyLogo } from "./VaultonomyLogo";
import { Wallet } from "./Wallet";
import {
  VaultonomyRoot,
  VaultonomyStateContext,
} from "./state/VaultonomyState";

const queryClient = new QueryClient();

export function DevServerRoot(): JSX.Element {
  return (
    <DevServerContext.Provider value={true}>
      <App />
    </DevServerContext.Provider>
  );
}

export function App() {
  const help = useRootHelpState();

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <VaultonomyRoot>
          <HelpContext.Provider value={help}>
            <AppUI />
          </HelpContext.Provider>
        </VaultonomyRoot>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function AppUI() {
  const [vaultonomy, dispatch] = useContext(VaultonomyStateContext);
  const userProfile =
    (
      vaultonomy.redditState.state === "tabAvailable" &&
      vaultonomy.redditState.userProfile?.state === "loaded"
    ) ?
      vaultonomy.redditState.userProfile.value
    : undefined;
  return (
    <>
      <header className="mt-32 mb-16 w-72 max-w-full mx-auto">
        <VaultonomyLogo className="" />
      </header>
      <main>
        <UserProfile
          profile={userProfile}
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
          <Vault />
          <Wallet />
        </div>

        <Pairing />

        {/* <UserAvatar avatarUrl="https://i.redd.it/snoovatar/avatars/nftv2_bmZ0X2VpcDE1NToxMzdfOWQ4NTQyZWYxMjM3OTMzYmFkYmU4NjcyOTFmNmMwNDM0YjhkMzE1Y18yNzEz_rare_0411a65f-b673-43bf-ae65-b7cc7c9349a2.png" />
        <UserAvatar avatarUrl="https://i.redd.it/snoovatar/avatars/7d436c39-b6be-4e4b-8d42-5c51562e1095.png" /> */}
      </main>

      <HelpModal />
    </>
  );
}
