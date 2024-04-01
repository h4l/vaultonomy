import { z } from "zod";

import { assert } from "../assert";

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

const activityTools = Object.keys(ActivityToolId.Values) as ActivityToolId[];
export function nextActivityTool(
  current: ActivityToolId,
  offset: number,
): ActivityToolId {
  const result = getValueAtValueIndexOffset(activityTools, current, offset);
  assert(result);
  return result;
}

const collectablesTools = Object.keys(
  CollectablesToolId.Values,
) as CollectablesToolId[];
export function nextCollectablesTool(
  current: CollectablesToolId,
  offset: number,
): CollectablesToolId {
  const result = getValueAtValueIndexOffset(collectablesTools, current, offset);
  assert(result);
  return result;
}

function getValueAtValueIndexOffset<T>(
  values: ReadonlyArray<T>,
  value: T,
  offset: number,
): T | undefined {
  const index = values.indexOf(value);
  if (index < 0) return undefined;
  return values.at((index + offset) % values.length);
}
