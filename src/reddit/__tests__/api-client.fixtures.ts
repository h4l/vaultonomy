import { RedditEIP712Challenge } from "../api-client";

export const redditEIP712Challenge = (): RedditEIP712Challenge => ({
  domain: {
    chainId: "0x1",
    name: "reddit",
    salt: "reddit-sIvILoedIcisHANTEmpE",
    verifyingContract: "",
    version: "1",
  },
  message: {
    address: "0x0000000000000000000000000000000000000000",
    expiresAt: "2023-01-01T00:00:00Z",
    nonce: "fkldsfjlksdafj",
    redditUserName: "example",
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
});

export const MetaApiMeAddressResponses = {
  empty: (): ReadonlyArray<Record<string, unknown>> => [
    {},
    {
      pointsDocsBaseUrl:
        "meta.redditmedia.com/public/all/mobile_copy/crypto/20200515/",
    },
    {
      addresses: null,
      pointsDocsBaseUrl:
        "meta.redditmedia.com/public/all/mobile_copy/crypto/20200515/",
    },
    {
      addresses: {},
      pointsDocsBaseUrl:
        "meta.redditmedia.com/public/all/mobile_copy/crypto/20200515/",
    },
    {
      addresses: {
        ethereum: null,
      },
      pointsDocsBaseUrl:
        "meta.redditmedia.com/public/all/mobile_copy/crypto/20200515/",
    },
    {
      addresses: {
        ethereum: [],
      },
      pointsDocsBaseUrl:
        "meta.redditmedia.com/public/all/mobile_copy/crypto/20200515/",
    },
    {
      addresses: {
        ethereum: [null],
      },
      pointsDocsBaseUrl:
        "meta.redditmedia.com/public/all/mobile_copy/crypto/20200515/",
    },
    {
      addresses: {
        ethereum: [],
      },
      pointsDocsBaseUrl:
        "meta.redditmedia.com/public/all/mobile_copy/crypto/20200515/",
    },
  ],
  single: (): Record<string, unknown> => ({
    addresses: {
      ethereum: [
        {
          address: "0x5318810BD26f9209c3d4ff22891F024a2b0A739a",
          createdAt: 1704694321215,
          isActive: true,
          modifiedAt: 1704694321215,
        },
      ],
    },
    pointsDocsBaseUrl:
      "meta.redditmedia.com/public/all/mobile_copy/crypto/20200515/",
  }),
  multi: (): Record<string, unknown> => ({
    addresses: {
      ethereum: [
        {
          address: "0x2bBA0433D7D798981d08EC4aC93d3bd301F3b4Bd",
          createdAt: 1675509156828,
        },
        {
          address: "0x5d70d1DdA55C6EC028de8de42395Be1Cf43F0815",
          createdAt: 1676029402882,
          isActive: true,
        },
      ],
    },
    pointsDocsBaseUrl:
      "meta.redditmedia.com/public/all/mobile_copy/crypto/20200515/",
  }),
} as const;
