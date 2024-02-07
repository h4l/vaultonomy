import { expect } from "@jest/globals";
import { concat, hashTypedData, keccak256 } from "viem";

import { RedditEIP712Challenge } from "../reddit/api-client";
import { normaliseRedditChallenge } from "../signing";

// Verify Wagmi/ Viem behaviour when hashing / signing EIP-712 typed data. The
// reddit address pairing challenge messages use EIP-712, but have some quirks.
// We must ensure our implementation hashes the domain and message in the same
// way that reddit's own implementation does, otherwise reddit will reject the
// signed hashes we produce.

/** A real challenge received from Reddit's API */
const exampleRedditChallenge = () =>
  ({
    payload: {
      domain: {
        chainId: "0x1",
        name: "reddit",
        salt: "reddit-sIvILoedIcisHANTEmpE",
        verifyingContract: "",
        version: "1",
      },
      message: {
        address: "0x2bba0433d7d798981d08ec4ac93d3bd301f3b4bd",
        expiresAt: "2023-02-04T11:17:36Z",
        nonce:
          "3afeac718855f79a1052384582f3e7bff7c8606d5e225c00db9db977897d5d04",
        redditUserName: "carbonatedcamel",
      },
      primaryType: "Challenge",
      types: {
        Challenge: [
          { name: "address", type: "address" },
          { name: "nonce", type: "string" },
          { name: "expiresAt", type: "string" },
          { name: "redditUserName", type: "string" },
        ],
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "version", type: "string" },
          { name: "salt", type: "string" },
        ],
      },
    },
  }) as const;

// The values reddit calculates for the domain and message hash of this example
// typed data.
const expectedDomainHash =
  "0x7ba5661dd0ce2767a99b4ab20a3ff32713b280c5097ca1311fc475ed993f9a0c";
const expectedMessageHash =
  "0x9b33dc3882459b90ab05404a2a3101a5732769df83fb3058ea9b29fbf703a551";
const expectedFullHash =
  "0xf1cc6afd86d38ef3676648a3d9ebffbd1e91bc70b6e6a172042eac0472bc5f06";

test("viem hashTypedData()", () => {
  const rawChallenge = RedditEIP712Challenge.parse(
    exampleRedditChallenge().payload,
  );
  const normalisedChallenge = normaliseRedditChallenge(rawChallenge);
  expect(hashTypedData(normalisedChallenge)).toEqual(expectedFullHash);
});

// Basically a cross-check of our test data to show that the full hash we verify
// above corresponds to the expected domain and message hashes (viem doesn't
// provide access to the intermediate parts).
test("verify expected domain and message hash match full hash", () => {
  const fullHash = keccak256(
    // 0x19 is the prefix for signed messages
    // 0x01 is the type ID of EIP-712 messages
    concat(["0x1901", expectedDomainHash, expectedMessageHash]),
  );
  expect(fullHash).toEqual(expectedFullHash);
});
