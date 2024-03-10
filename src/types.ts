import { Address, checksumAddress, getAddress, isAddress } from "viem";
import { z } from "zod";

function transformAddress(
  rawAddress: string,
  context: z.RefinementCtx,
): { rawAddress: Address; checksumAddress: Address } {
  const withoutChecksum = rawAddress.toLowerCase();
  if (!isAddress(withoutChecksum)) {
    context.addIssue({
      message: "Invalid address",
      code: z.ZodIssueCode.custom,
    });
    return z.NEVER;
  }

  const checksumAddress = getAddress(withoutChecksum);

  // If the address is lowercase we don't validate its checksum
  if (withoutChecksum === rawAddress) return { rawAddress, checksumAddress };

  if (checksumAddress !== rawAddress) {
    context.addIssue({
      message: "Invalid address checksum",
      code: z.ZodIssueCode.custom,
    });
    return z.NEVER;
  }
  return { rawAddress, checksumAddress };
}

/** An Ethereum 0x... address.
 *
 * If any chars are uppercase, it's treated as a checksum address and validation
 * fails if the checksum is not correct.
 *
 * The value is transformed into a checksum address if it's not already.
 */
export const EthAddress = z
  .string()
  .transform(
    (arg, context): Address => transformAddress(arg, context).checksumAddress,
  );

/**
 * A `0x...` address, byte-for-byte identical to lowercase or checksum input format.
 *
 * Non-lowercase inputs are validate and parsing fails if the checksum is not
 * correct. Lowercase inputs are only validated to be valid Eth hex addresses.
 */
export const RawEthAddress = z
  .string()
  .transform(
    (arg, context): Address => transformAddress(arg, context).rawAddress,
  );
export const HexString = z.string().regex(/^0x[0-9a-fA-F]*$/);
export type HexString = `0x${string}`;

export const EthHexSignature = z
  .string()
  .regex(/^0x[0-9a-f]{130}$/, "Invalid hex signature string")
  .transform((s) => s.toLowerCase());

export type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[] ? RecursivePartial<U>[]
  : T[P] extends object | undefined ? RecursivePartial<T[P]>
  : T[P];
};

// https://github.com/wevm/wagmi/blob/e9289fa973190aa59a077a2bfb6cc7f2bd901e59/packages/core/src/types/utils.ts#L3
/** Combines members of an intersection into a readable type. */
// https://twitter.com/mattpocockuk/status/1622730173446557697?s=20&t=NdpAcmEFXY01xkqU3KO0Mg
export type Evaluate<type> = { [key in keyof type]: type[key] } & unknown;

export type RequiredNonNullable<T> = {
  [P in keyof T]-?: NonNullable<T[P]>;
};

export type Unbind = () => void;
export type Disconnect = Unbind;
