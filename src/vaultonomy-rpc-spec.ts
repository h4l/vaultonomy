import { z } from "zod";

import { PortName } from "./PortName";
import { InterestInUserEvent } from "./messaging";
import { defineMethod } from "./rpc/typing";
import { VaultonomyUserPreferences } from "./settings/VaultonomySettings";

export const VAULTONOMY_RPC_PORT = new PortName("vaultonomy-rpc");

/*
 * Vaultonomy uses bi-directional RPC to communicate between the UI and the
 * extension's background service worker.
 *
 * The UI is either the side panel, which runs as part of the extension, or, in
 * dev mode, a separate web page running from the Vite dev-server.
 *
 * You can think of the bi-directional RPC as two client->server pairs:
 * - The UI runs a server which the background worker makes requests to, e.g.
 *   to notify it that a Reddit tab is available, or has disconnected.
 * - The background worker runs a server, which the UI makes requests to, e.g.
 *   to ask for Reddit account information, or make changes to the account's
 *   Vault.
 */

export const RedditTabBecameAvailableEvent = z.object({
  type: z.literal("redditTabBecameAvailable"),
});
export const RedditTabBecameUnavailableEvent = z.object({
  type: z.literal("redditTabBecameUnavailable"),
});
export const SettingsChangedEvent = z.object({
  type: z.literal("settingsChanged"),
});
export type SettingsChangedEvent = z.infer<typeof SettingsChangedEvent>;

function createTaggedEventSchema<T extends z.ZodTypeAny>(eventSchema: T) {
  return z.object({
    type: z.literal("tagged"),
    senderId: z.string().min(1),
    order: z.number().nonnegative(),
    event: eventSchema,
  });
}
export type TaggedEvent<T> = z.infer<
  ReturnType<typeof createTaggedEventSchema<z.Schema<T>>>
>;

export const TaggedVaultonomyBackgroundEvent = createTaggedEventSchema(
  InterestInUserEvent.or(SettingsChangedEvent),
);
export type TaggedVaultonomyBackgroundEvent = z.infer<
  typeof TaggedVaultonomyBackgroundEvent
>;

export const VaultonomyBackgroundEvent = z.discriminatedUnion("type", [
  RedditTabBecameAvailableEvent,
  RedditTabBecameUnavailableEvent,
  TaggedVaultonomyBackgroundEvent,
]);
export type VaultonomyBackgroundEvent = z.infer<
  typeof VaultonomyBackgroundEvent
>;

export const VaultonomyUiNotify = defineMethod({
  name: "vaultonomyUi_notify",
  params: VaultonomyBackgroundEvent,
  returns: z.null(),
});

export const RedditTabAvailability = z.object({
  available: z.boolean(),
});
export type RedditTabAvailability = z.infer<typeof RedditTabAvailability>;

export const VaultonomyGetRedditTabAvailability = defineMethod({
  name: "vaultonomy_getRedditTabAvailability",
  params: z.null(),
  returns: RedditTabAvailability,
});

export const VaultonomyGetUiNotifications = defineMethod({
  name: "vaultonomy_getUiNotifications",
  params: z.null(),
  returns: z.array(TaggedVaultonomyBackgroundEvent),
});

export const VaultonomySettings = z.object({
  preferences: VaultonomyUserPreferences,
  permissions: z.object({
    redditTabAccess: z.enum(["all", "activeTab"]),
  }),
});
export type VaultonomySettings = z.infer<typeof VaultonomySettings>;

export const VaultonomyGetSettings = defineMethod({
  name: "vaultonomy_getSettings",
  params: z.null(),
  returns: VaultonomySettings,
});
