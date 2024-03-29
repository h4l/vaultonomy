import { RedditEIP712Challenge } from "../api-client";

export const GetVaultRegistrationChallengeResponses = () =>
  ({
    example: {
      data: {
        vault: {
          registrationChallenge: {
            payload: {
              domain:
                '{"chainId": "0x1", "name": "reddit", "salt": "reddit-sIvILoedIcisHANTEmpE", "verifyingContract": "", "version": "1"}',
              message:
                '{"address": "0xbc10830df34d3bf10d934f008a191f3a85b4dd51", "expiresAt": "2024-03-29T04:24:59Z", "nonce": "b9a5a9151606ca9cc7ccb40d513b2865f40a7834a5214889ed9515f188e77c14", "redditUserName": "carbonatedcamel"}',
              primaryType: "Challenge",
              types: {
                challenge: [
                  {
                    name: "address",
                    type: "ADDRESS",
                  },
                  {
                    name: "nonce",
                    type: "STRING",
                  },
                  {
                    name: "expiresAt",
                    type: "STRING",
                  },
                  {
                    name: "redditUserName",
                    type: "STRING",
                  },
                ],
                eip712Domain: [
                  {
                    name: "name",
                    type: "STRING",
                  },
                  {
                    name: "chainId",
                    type: "UINT256",
                  },
                  {
                    name: "version",
                    type: "STRING",
                  },
                  {
                    name: "salt",
                    type: "STRING",
                  },
                ],
              },
            },
          },
        },
      },
    },
  }) as const;

export const RedditEIP712Challenges = () => ({
  example: {
    domain: {
      chainId: "0x1",
      name: "reddit",
      salt: "reddit-sIvILoedIcisHANTEmpE",
      verifyingContract: "",
      version: "1",
    },
    message: {
      address: "0xbc10830df34d3bf10d934f008a191f3a85b4dd51",
      expiresAt: "2024-03-29T04:24:59Z",
      nonce: "b9a5a9151606ca9cc7ccb40d513b2865f40a7834a5214889ed9515f188e77c14",
      redditUserName: "carbonatedcamel",
    },
    primaryType: "Challenge",
    types: {
      Challenge: [
        {
          name: "address",
          type: "address",
        },
        {
          name: "nonce",
          type: "string",
        },
        {
          name: "expiresAt",
          type: "string",
        },
        {
          name: "redditUserName",
          type: "string",
        },
      ],
      EIP712Domain: [
        {
          name: "name",
          type: "string",
        },
        {
          name: "chainId",
          type: "uint256",
        },
        {
          name: "version",
          type: "string",
        },
        {
          name: "salt",
          type: "string",
        },
      ],
    },
  } satisfies RedditEIP712Challenge,
});

export const RegisterVaultAddressResponses = () => ({
  example: {
    data: {
      registerVaultAddress: {
        errors: null,
        ok: true,
      },
    },
  },
  // This is speculative, I've not triggered real error response yet
  error: {
    data: {
      registerVaultAddress: {
        errors: "oops",
      },
    },
  },
});
export const GetUserVaultQueryResponses = () =>
  ({
    noVault: {
      data: {
        vault: {
          contact: null,
        },
      },
    },
    hasVault: {
      data: {
        vault: {
          contact: {
            address: "0xbc10830dF34D3bf10d934f008A191F3a85B4DD51",
            isActive: true,
            userId: "t2_4h7kj7wob",
          },
        },
      },
    },
  }) as const;

export const GetAllVaultsQueryResponses = () =>
  ({
    none: {
      data: {
        vault: {
          addresses: [],
        },
      },
    },
    single: {
      data: {
        vault: {
          addresses: [
            {
              address: "0xA5C590Ab4f9d1E75a77a41e00f50113B0806F280",
              createdAt: "2024-02-18T07:32:19.000000+0000",
              isActive: true,
              provider: "ethereum",
            },
          ],
        },
      },
    },
    multiple: {
      data: {
        vault: {
          addresses: [
            {
              address: "0x2bBA0433D7D798981d08EC4aC93d3bd301F3b4Bd",
              createdAt: "2023-02-04T11:12:36.000000+0000",
              isActive: false,
              provider: "ethereum",
            },
            {
              address: "0x5d70d1DdA55C6EC028de8de42395Be1Cf43F0815",
              createdAt: "2023-02-10T11:43:22.000000+0000",
              isActive: false,
              provider: "ethereum",
            },
            {
              address: "0xA5C590Ab4f9d1E75a77a41e00f50113B0806F280",
              createdAt: "2024-02-18T07:32:19.000000+0000",
              isActive: true,
              provider: "ethereum",
            },
          ],
        },
      },
    },
  }) as const;

export const oauthRedditUserAboutResponseSuspended = () =>
  ({
    kind: "t2",
    data: {
      name: "MetaMask",
      is_suspended: true,
      awardee_karma: 0,
      awarder_karma: 0,
      is_blocked: false,
      total_karma: 0,
    },
  }) as const;

export const oauthRedditUserAboutResponse = () =>
  ({
    kind: "t2",
    data: {
      is_employee: false,
      is_friend: false,
      subreddit: {
        default_set: true,
        user_is_contributor: false,
        banner_img: "",
        allowed_media_in_comments: [],
        user_is_banned: false,
        free_form_reports: true,
        community_icon: null,
        show_media: true,
        icon_color: "",
        user_is_muted: null,
        display_name: "u_carbonatedcamel",
        header_img: null,
        title: "",
        previous_names: [],
        over_18: false,
        icon_size: [256, 256],
        primary_color: "",
        icon_img:
          "https://styles.redditmedia.com/t5_7vae3z/styles/profileIcon_snoodb365226-120c-40fd-b8d6-e2ef120f3b45-headshot.png?width=256\u0026height=256\u0026crop=256:256,smart\u0026s=e65b37ed86118f8cba6a0cb15cc08488cbe6ab69",
        description: "",
        submit_link_label: "",
        header_size: null,
        restrict_posting: true,
        restrict_commenting: false,
        subscribers: 0,
        submit_text_label: "",
        is_default_icon: false,
        link_flair_position: "",
        display_name_prefixed: "u/carbonatedcamel",
        key_color: "",
        name: "t5_7vae3z",
        is_default_banner: true,
        url: "/user/carbonatedcamel/",
        quarantine: false,
        banner_size: null,
        user_is_moderator: false,
        accept_followers: true,
        public_description: "",
        link_flair_enabled: false,
        disable_contributor_requests: false,
        subreddit_type: "user",
        user_is_subscriber: false,
      },
      awarded_last_month: {
        total_count: 0,
        top_award: null,
      },
      snoovatar_size: [380, 600],
      awardee_karma: 0,
      id: "4h7kj7wob",
      gilded_last_month: {},
      verified: true,
      is_gold: false,
      is_mod: false,
      awarder_karma: 0,
      has_verified_email: true,
      icon_img:
        "https://styles.redditmedia.com/t5_7vae3z/styles/profileIcon_snoodb365226-120c-40fd-b8d6-e2ef120f3b45-headshot.png?width=256\u0026height=256\u0026crop=256:256,smart\u0026s=e65b37ed86118f8cba6a0cb15cc08488cbe6ab69",
      hide_from_robots: false,
      link_karma: 1,
      pref_show_snoovatar: false,
      is_blocked: false,
      total_karma: 1,
      accept_chats: true,
      name: "carbonatedcamel",
      created: 1675508135.0,
      created_utc: 1675508135.0,
      snoovatar_img:
        "https://i.redd.it/snoovatar/avatars/db365226-120c-40fd-b8d6-e2ef120f3b45.png",
      comment_karma: 0,
      accept_followers: true,
      has_subscribed: true,
      accept_pms: true,
    },
  }) as const;
