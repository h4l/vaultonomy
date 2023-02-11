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
