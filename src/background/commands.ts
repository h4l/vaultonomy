import { log } from "../logging";
import { VaultonomyUserPreferencesStore } from "../settings/VaultonomySettings";
import {
  nextActivityTool,
  nextCollectablesTool,
} from "../settings/address-activity-tools";
import { Stop } from "../types";
import { browser } from "../webextension";

export type Command =
  | "next_address_activity_tool"
  | "prev_address_activity_tool"
  | "next_address_collectables_tool"
  | "prev_address_collectables_tool";

export function handleCommandEvents({
  userPrefs,
}: {
  userPrefs: VaultonomyUserPreferencesStore;
}): Stop {
  const commands = new Map(
    Object.entries({
      next_address_activity_tool: async () => {
        const { addressActivityTool: current } =
          await userPrefs.getProperties();
        await userPrefs.setProperties({
          addressActivityTool: nextActivityTool(current, 1),
        });
      },
      prev_address_activity_tool: async () => {
        const { addressActivityTool: current } =
          await userPrefs.getProperties();
        await userPrefs.setProperties({
          addressActivityTool: nextActivityTool(current, -1),
        });
      },
      next_address_collectables_tool: async () => {
        const { addressCollectablesTool: current } =
          await userPrefs.getProperties();
        await userPrefs.setProperties({
          addressCollectablesTool: nextCollectablesTool(current, 1),
        });
      },
      prev_address_collectables_tool: async () => {
        const { addressCollectablesTool: current } =
          await userPrefs.getProperties();
        await userPrefs.setProperties({
          addressCollectablesTool: nextCollectablesTool(current, -1),
        });
      },
    } satisfies Record<Command, () => Promise<void>>),
  );

  const onCommand = (command: string, _tab: chrome.tabs.Tab): void => {
    const run = commands.get(command);
    if (run) {
      log.debug("running command:", command);
      run().catch((error) => {
        log.error("failed to run command:", command, error);
      });
    }
  };

  browser.commands.onCommand.addListener(onCommand);
  return () => browser.commands.onCommand.removeListener(onCommand);
}
