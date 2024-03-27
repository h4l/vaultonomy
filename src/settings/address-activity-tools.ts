import { z } from "zod";

export const ActivityToolId = z.enum([
  "arkham",
  "blockscan",
  "debank",
  "nansen",
  "zapper",
]);
export type ActivityToolId = z.infer<typeof ActivityToolId>;

export const CollectablesToolId = z.enum([
  "avatardex",
  "firstmate",
  "magiceden",
  "opensea",
  "opensea-pro",
  "rarible",
  "rcax",
]);
export type CollectablesToolId = z.infer<typeof CollectablesToolId>;

type AddressToolId = ActivityToolId | CollectablesToolId;

type AddressTool = { readonly name: string };

export const ADDRESS_TOOLS: Record<
  ActivityToolId | CollectablesToolId,
  AddressTool
> = {
  "opensea-pro": { name: "OpenSea Pro" },
  arkham: { name: "Arkham" },
  avatardex: { name: "AvatarDex" },
  blockscan: { name: "Blockscan" },
  debank: { name: "DeBank" },
  firstmate: { name: "FirstMate" },
  magiceden: { name: "Magic Eden" },
  nansen: { name: "Nansen" },
  opensea: { name: "OpenSea" },
  rarible: { name: "Rarible" },
  rcax: { name: "RCAX" },
  zapper: { name: "Zapper" },
};
export const DEFAULT_ACTIVITY_TOOL: ActivityToolId = "blockscan";
export const DEFAULT_COLLECTABLES_TOOL: CollectablesToolId = "opensea";

export function orderAddressToolIdByToolName(
  a: AddressToolId,
  b: AddressToolId,
): number {
  return ADDRESS_TOOLS[a].name.localeCompare(ADDRESS_TOOLS[b].name);
}
