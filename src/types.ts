import { Address, getAddress, isAddress } from "viem";
import { z } from "zod";

/** An Ethereum 0x... address.
 *
 * If any chars are uppercase, it's treated as a checksum address and validation
 * fails if the checksum is not correct.
 *
 * The value is transformed into a checksum address if it's not already.
 */
export const EthAddress = z.string().transform((arg, context): Address => {
  if (!isAddress(arg)) {
    context.addIssue({
      message: "Invalid address",
      code: z.ZodIssueCode.custom,
    });
    return z.NEVER;
  }

  const checksumAddress = getAddress(arg);

  // If the address is lowercase we don't validate its checksum
  if (arg.toLowerCase() === arg) return checksumAddress;

  if (checksumAddress !== arg) {
    context.addIssue({
      message: "Invalid address checksum",
      code: z.ZodIssueCode.custom,
    });
    return z.NEVER;
  }
  return checksumAddress;
});

export const HexString = z.string().regex(/^0x[0-9a-fA-F]*$/);
export type HexString = `0x${string}`;

export const EthHexSignature = z
  .string()
  .regex(/^0x[0-9a-f]{130}$/, "Invalid hex signature string")
  .transform((s) => s.toLowerCase());
