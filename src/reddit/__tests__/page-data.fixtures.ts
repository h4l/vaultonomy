import { AnonPageData, UserPageData } from "../page-data";
import { RedditUserProfile } from "../types";

export const pageDataLoggedIn = (): Record<string, unknown> => ({
  other: { stuff: true },
  user: {
    other: { stuff: true },
    account: {
      other: { stuff: true },
      id: "t2_abc",
      isGold: true,
      snoovatarFullBodyAsset: "https://example.com/imgFull",
      accountIcon: "https://example.com/imgSquare",
      displayText: "exampleuser",
    },
    session: {
      accessToken: "abc-123",
      expires: "2023-01-01T00:00:00.000Z",
    },
  },
});

export const pageDataLoggedOut = (): Record<string, unknown>[] => [
  {
    other: { stuff: true },
    user: {
      account: null,
      session: {
        accessToken: "abc-123",
        expires: "2023-01-01T00:00:00.000Z",
      },
    },
  },
  {
    other: { stuff: true },
    user: {
      account: null,
      session: {},
    },
  },
  {
    other: { stuff: true },
    user: {
      account: null,
      session: null,
    },
  },
];

export const anonUser = (): AnonPageData => ({ loggedIn: false });
export const loggedInUser = ({
  authExpires,
}: {
  authExpires?: Date;
} = {}): UserPageData => ({
  loggedIn: true,
  user: {
    userID: "t2_abc",
    username: "exampleuser",
    accountIconFullBodyURL: "https://example.com/imgFull",
    accountIconURL: "https://example.com/imgSquare",
    hasPremium: true,
    isSuspended: false,
  },
  auth: {
    token: "secret",
    expires: authExpires ?? new Date("2023-01-02T00:00:00Z"),
  },
});

export const userProfile: () => RedditUserProfile = () => ({
  userID: "t2_4h7kj7wob",
  username: "carbonatedcamel",
  hasPremium: false,
  accountIconFullBodyURL:
    "https://i.redd.it/snoovatar/avatars/db365226-120c-40fd-b8d6-e2ef120f3b45.png",
  accountIconURL:
    "https://styles.redditmedia.com/t5_7vae3z/styles/profileIcon_snoodb365226-120c-40fd-b8d6-e2ef120f3b45-headshot.png?width=256\u0026height=256\u0026crop=256:256,smart\u0026s=e65b37ed86118f8cba6a0cb15cc08488cbe6ab69",
  isSuspended: false,
});
