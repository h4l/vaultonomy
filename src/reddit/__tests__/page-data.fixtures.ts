import { AnonPageData, UserPageData } from "../page-data";

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
  },
  auth: {
    token: "secret",
    expires: authExpires ?? new Date("2023-01-02T00:00:00Z"),
  },
});
