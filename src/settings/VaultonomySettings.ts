import { z } from "zod";

import { SyncedPropertiesStore } from "./SyncedPropertiesStore";
import {
  ActivityToolId,
  CollectablesToolId,
  DEFAULT_ACTIVITY_TOOL,
  DEFAULT_COLLECTABLES_TOOL,
} from "./address-activity-tools";

const PROPERTY_PREFIX = "vaultonomy.options.";

/**
 * Properties representing user's settings to be stored in chrome.storage.sync.
 */
export const VaultonomyUserPreferences = z.object({
  addressActivityTool: ActivityToolId,
  addressCollectablesTool: CollectablesToolId,
});
export type VaultonomyUserPreferences = z.infer<
  typeof VaultonomyUserPreferences
>;

export type VaultonomyUserPreferencesStore = SyncedPropertiesStore<
  typeof VaultonomyUserPreferences
>;

export function defaultPreferences(): VaultonomyUserPreferences {
  return {
    addressActivityTool: DEFAULT_ACTIVITY_TOOL,
    addressCollectablesTool: DEFAULT_COLLECTABLES_TOOL,
  };
}

export function createPreferencesStore(): VaultonomyUserPreferencesStore {
  return new SyncedPropertiesStore({
    schema: VaultonomyUserPreferences,
    defaultProperties: defaultPreferences,
    keyPrefix: PROPERTY_PREFIX,
  });
}
