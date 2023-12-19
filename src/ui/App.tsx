import { UserProfile } from "./UserProfile";
import { VaultonomyLogo } from "./VaultonomyLogo";

export default function App() {
  return (
    <>
      <div className="absolute w-full h-full">
        <main className="">
          <header className="mt-32 mb-16 w-72 max-w-full mx-auto">
            <VaultonomyLogo className="" />
          </header>
          <UserProfile
            profile={{
              hasPremium: true,
              userID: "abc123",
              username: "h4l",
              accountIconURL:
                "https://i.redd.it/snoovatar/avatars/nftv2_bmZ0X2VpcDE1NToxMzdfOWQ4NTQyZWYxMjM3OTMzYmFkYmU4NjcyOTFmNmMwNDM0YjhkMzE1Y18yNzEz_rare_0411a65f-b673-43bf-ae65-b7cc7c9349a2.png",
            }}
          />
          {/* <UserAvatar avatarUrl="https://i.redd.it/snoovatar/avatars/nftv2_bmZ0X2VpcDE1NToxMzdfOWQ4NTQyZWYxMjM3OTMzYmFkYmU4NjcyOTFmNmMwNDM0YjhkMzE1Y18yNzEz_rare_0411a65f-b673-43bf-ae65-b7cc7c9349a2.png" />
        <UserAvatar avatarUrl="https://i.redd.it/snoovatar/avatars/7d436c39-b6be-4e4b-8d42-5c51562e1095.png" /> */}
        </main>
      </div>
    </>
  );
}
