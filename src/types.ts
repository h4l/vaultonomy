import { utils } from "ethers";
import { z } from "zod";

/** An Ethereum 0x... address.
 *
 * If any chars are uppercase, it's treated as a checksum address and validation
 * fails if the checksum is not correct.
 *
 * The value is transformed into a checksum address if it's not already.
 */
export const EthAddress = z.string().transform((arg, context): string => {
  try {
    return utils.getAddress(arg);
  } catch (e) {
    const reason =
      (e as { reason?: string }).reason === "bad address checksum"
        ? "Invalid address checksum"
        : "Invalid address";
    context.addIssue({ message: reason, code: z.ZodIssueCode.custom });
  }
  return arg;
});

export const EthHexSignature = z
  .string()
  .regex(/^0x[0-9a-f]{130}$/, "Invalid hex signature string")
  .transform((s) => s.toLowerCase());
