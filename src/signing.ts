import {
  Address,
  ByteArray,
  Hex,
  hashTypedData,
  isAddressEqual,
  verifyTypedData,
} from "viem";
import { normalizeChainId } from "wagmi";

import { VaultonomyError } from "./VaultonomyError";
import { RedditEIP712Challenge } from "./reddit/api-client";
import { Evaluate } from "./types";
import { Result } from "./ui/state/createVaultonomyStore";

type RedditEIP712ChallengeDomain = RedditEIP712Challenge["domain"];
type NormalisedDomain = Omit<
  RedditEIP712ChallengeDomain,
  "chainId" | "verifyingContract"
> & { chainId: bigint };
export type NormalisedRedditEIP712Challenge = Evaluate<
  Omit<RedditEIP712Challenge, "domain"> & {
    domain: NormalisedDomain;
  }
>;

/**
 * Normalise the Reddit EIP-712 challenge data.
 *
 * The EIP-712 data Reddit provides has a few quirks that mean it needs some
 * massaging to work with eth libraries (Viem/Wagmi are not unique, ethers.js
 * and the Python eth_account lib behave similarly).
 *
 * @param raw The EIP-712 data received from Reddit
 * @returns The normalised version of the challenge that works with Eth
 * libs/wallets.
 */
export function normaliseRedditChallenge(
  raw: RedditEIP712Challenge,
): NormalisedRedditEIP712Challenge {
  // Reddit's EIP-712 data contains a verifyingContract field in the domain data
  // containing an empty string. Its EIP712Domain type does not contain this
  // field, so having it in the data should have no effect (it's ignored). In
  // the past ethers.js rejected this data as invalid. Viem/Wagmi ignore it, but
  // we'll remove it anyway.
  const { verifyingContract: _notUsed, ...rawDomain } = raw.domain;

  const normalisedDomain = {
    ...rawDomain,
    // The chainIs a uint256 in EIP712Domain. Reddit's Data specifies the value
    // as "0x01" rather than an integer 1. Viem/Wagmi and other libraries reject
    // the hex version, so we normalise it to a bigint, i.e. actually a uint256.
    chainId: BigInt(normalizeChainId(raw.domain.chainId)),
  };
  // Another quirk is that the EIP712Domain's salt is typed as a string, rather
  // than bytes32 as EIP-712 defines. Wallets I've tested don't seem to mind
  // this, but perhaps some will reject it. We can't normalise this because
  // changing the string type to bytes32 would change the domain hash.
  //
  // And the most minor is that the EIP712Domain fields are not in the order
  // suggested by EIP-712. Luckily the spec doesn't make order a hard
  // requirement, and implementations need to support the order defined by the
  // data.

  return {
    ...raw,
    domain: normalisedDomain,
  };
}

class InvalidOwnershipChallengeError extends VaultonomyError {
  constructor(
    message: string,
    public readonly challenge:
      | RedditEIP712Challenge
      | NormalisedRedditEIP712Challenge,
    public readonly expectedUsername: string,
    public readonly expectedAddress: Address,
  ) {
    super(message);
  }
}

export function validateRedditChallenge({
  challenge,
  address,
  redditUserName,
}: {
  challenge: RedditEIP712Challenge | NormalisedRedditEIP712Challenge;
  redditUserName: string;
  address: Address;
}): void {
  if (!isAddressEqual(address, challenge.message.address)) {
    throw new InvalidOwnershipChallengeError(
      "Challenge message's addresses is not the expected address",
      challenge,
      redditUserName,
      address,
    );
  }
  if (redditUserName !== challenge.message.redditUserName) {
    throw new InvalidOwnershipChallengeError(
      "Challenge message's redditUserName is not the expected redditUserName",
      challenge,
      redditUserName,
      address,
    );
  }
}

export type VerifySignedRedditChallengeResult =
  | { isValid: true }
  | { isValid: false; reasonShort: string; reason: string };

export async function verifySignedRedditChallenge({
  challenge,
  expectedAddress,
  signature,
}: {
  challenge: NormalisedRedditEIP712Challenge;
  expectedAddress: Address;
  signature: Hex;
}): Promise<VerifySignedRedditChallengeResult> {
  if (isAddressEqual(expectedAddress, challenge.message.address))
    if (
      await verifyTypedData({
        ...challenge,
        address: expectedAddress,
        signature,
      })
    ) {
      // Note that we're are are intentionally not trying to verify contract/non-EOA
      // signatures here. I've not tested empirically, but my belief is that Reddit
      // won't be verifying contract signatures (which is a shame, as they' be very
      // useful to manage large numbers of NFTs). Reddit's messages use chain 1 (Eth
      // mainnet), so presumably a contract wallet would need to be on mainnet,
      // which could a.) make it expensive to use, an b) not very practical for
      // managing NFTs on Polygon POS.
      return { isValid: true };
    }
  return {
    isValid: false,
    reasonShort: "Signature does not match the message and Wallet address.",
    reason:
      `Signature ${signature} is not valid for expected address ` +
      `${expectedAddress} and message hash ${hashTypedData(challenge)}`,
  };
}
