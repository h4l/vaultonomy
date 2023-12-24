import { Button } from "./Button";
import { EthAccount } from "./EthAccount";
import { UserProfile } from "./UserProfile";
import { VaultonomyLogo } from "./VaultonomyLogo";

export default function App() {
  return (
    <>
      <header className="mt-32 mb-16 w-72 max-w-full mx-auto">
        <VaultonomyLogo className="" />
      </header>
      <main>
        <UserProfile
          profile={{
            hasPremium: true,
            userID: "abc123",
            username: "h4l",
            accountIconURL:
              "https://i.redd.it/snoovatar/avatars/nftv2_bmZ0X2VpcDE1NToxMzdfOWQ4NTQyZWYxMjM3OTMzYmFkYmU4NjcyOTFmNmMwNDM0YjhkMzE1Y18yNzEz_rare_0411a65f-b673-43bf-ae65-b7cc7c9349a2.png",
          }}
        />
        <div className="m-10 flex flex-col justify-center items-center">
          <Button className="">Connect to Wallet</Button>
        </div>

        <div className="m-10 flex flex-col justify-center items-center">
          <EthAccount
            title="Reddit Vault"
            ethAddress="0xd2A2B709af3B6d0bba1cCbd1edD65f353aA42C66"
            ensName="h-a-l.eth"
            footer={
              <span aria-label="status" className="italic text-sm my-4">
                Paired 5 minutes ago
              </span>
            }
          />
        </div>

        {/* <UserAvatar avatarUrl="https://i.redd.it/snoovatar/avatars/nftv2_bmZ0X2VpcDE1NToxMzdfOWQ4NTQyZWYxMjM3OTMzYmFkYmU4NjcyOTFmNmMwNDM0YjhkMzE1Y18yNzEz_rare_0411a65f-b673-43bf-ae65-b7cc7c9349a2.png" />
        <UserAvatar avatarUrl="https://i.redd.it/snoovatar/avatars/7d436c39-b6be-4e4b-8d42-5c51562e1095.png" /> */}
      </main>
    </>
  );
}
