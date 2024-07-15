import { Emitter, createNanoEvents } from "nanoevents";
import { z } from "zod";

import { assert } from "../assert";
import { log } from "../logging";
import {
  VaultonomyUserPreferences,
  VaultonomyUserPreferencesStore,
} from "../settings/VaultonomySettings";
import {
  ADDRESS_TOOLS,
  ActivityToolId,
  CollectablesToolId,
  orderAddressToolIdByToolName,
} from "../settings/address-activity-tools";
import { Stop } from "../types";
import { browser } from "../webextension";

function menuId(
  parentId: string | undefined,
  entry: CheckableEntry | NormalEntry | ParentEntry,
): string {
  const entryId = entry.id || entry.title.toLowerCase().replace(/\s+/g, "-");
  return parentId ? `${parentId}:${entryId}` : entryId;
}

function getCreateProps(
  entry: MenuEntry,
  parentId?: string,
): chrome.contextMenus.CreateProperties[] {
  const defaultProps: chrome.contextMenus.CreateProperties = {
    contexts: ["action"],
  };
  let id: string;
  switch (entry.type) {
    case "separator":
      return [{ ...defaultProps, parentId, contexts: ["action"], ...entry }];
    case "checkbox":
    case "radio":
      id = menuId(parentId, entry);
      return [
        { ...defaultProps, parentId, contexts: ["action"], ...entry, id },
      ];
    default: {
      assert(entry.type ?? "normal" === "normal");
      id = menuId(parentId, entry);
      const { children = [], ...props } = entry;
      return [
        { ...defaultProps, parentId, ...props, id },
        ...children.flatMap((e) => getCreateProps(e, id)),
      ];
    }
  }
}

type BaseEntry = {
  id?: string;
  title: string;
  enabled?: boolean;
  visible?: boolean;
};
type MenuEntry = NormalEntry | ParentEntry | CheckableEntry | SeparatorEntry;

type NormalEntry = BaseEntry & { type?: "normal"; children?: undefined };
type ParentEntry = BaseEntry & {
  type?: "normal";
  children?: Array<MenuEntry>;
};

type CheckableEntry = BaseEntry & {
  type: "checkbox" | "radio";
  checked?: boolean;
};

type SeparatorEntry = {
  id: string;
  type: "separator";
  visible?: boolean;
};

const menus: Array<MenuEntry> = [
  { title: "Open as tab" },
  { title: "Open as window" },
  { type: "separator", id: "options-separator" },
  {
    title: "Vaultonomy Options",
    children: [
      {
        title: "Address Activity Tool",
        children: Object.values(ActivityToolId.Values)
          .toSorted(orderAddressToolIdByToolName)
          .map((id) => ({
            id,
            type: "radio",
            title: ADDRESS_TOOLS[id].name,
          })),
      },
      {
        title: "Address Collectables Tool",
        children: Object.values(CollectablesToolId.Values)
          .toSorted(orderAddressToolIdByToolName)
          .map((id) => ({
            id,
            type: "radio",
            title: ADDRESS_TOOLS[id].name,
          })),
      },
    ],
  },
];

function parseEnum<T extends z.ZodEnum<V>, V extends [string, ...string[]]>(
  type: T,
  value: string,
): z.infer<T> | undefined {
  const result = type.safeParse(value);
  return result.success ? result.data : undefined;
}

function stripPrefix(str: string, prefix: string): string {
  return str.startsWith(prefix) ? str.substring(prefix.length) : str;
}

const activityIdPrefix = "vaultonomy-options:address-activity-tool:";
const collectablesIdPrefix = "vaultonomy-options:address-collectables-tool:";

function getActivityToolRadioMenuId(activityId: ActivityToolId): string {
  return `${activityIdPrefix}${activityId}`;
}

function getCollectablesToolRadioMenuId(
  collectablesId: CollectablesToolId,
): string {
  return `${collectablesIdPrefix}${collectablesId}`;
}

export type ContextMenuState = Pick<
  VaultonomyUserPreferences,
  "addressActivityTool" | "addressCollectablesTool"
>;

export class ActionContextMenu {
  readonly emitter: Emitter<{
    menuStateChanged: (options: Partial<ContextMenuState>) => void;
  }> = createNanoEvents();
  readonly menuState: Partial<ContextMenuState>;
  constructor(options: Partial<ContextMenuState> = {}) {
    this.onContextMenuClick = this.onContextMenuClick.bind(this);
    this.menuState = {};
    this.setMenuState(options);
  }

  getMenuState(): Partial<ContextMenuState> {
    return { ...this.menuState };
  }

  setMenuState(menuState: Partial<ContextMenuState>): void {
    const changes: Partial<ContextMenuState> = {};
    if (
      menuState.addressActivityTool &&
      menuState.addressActivityTool !== this.menuState.addressActivityTool
    ) {
      changes.addressActivityTool = menuState.addressActivityTool;
      if (this.#isStarted) {
        browser.contextMenus.update(
          getActivityToolRadioMenuId(menuState.addressActivityTool),
          { checked: true },
        );
      }
    }
    if (
      menuState.addressCollectablesTool &&
      menuState.addressCollectablesTool !==
        this.menuState.addressCollectablesTool
    ) {
      changes.addressCollectablesTool = menuState.addressCollectablesTool;
      if (this.#isStarted) {
        browser.contextMenus.update(
          getCollectablesToolRadioMenuId(menuState.addressCollectablesTool),
          { checked: true },
        );
      }
    }

    if (Object.keys(changes).length === 0) return;

    Object.assign(this.menuState, changes);
    this.emitter.emit("menuStateChanged", changes);
  }

  private onContextMenuClick(
    info: chrome.contextMenus.OnClickData,
    _tab?: chrome.tabs.Tab | undefined,
  ): void {
    let addressActivityTool: ActivityToolId | undefined;
    let addressCollectablesTool: CollectablesToolId | undefined;

    (async () => {
      if (info.menuItemId === "open-as-tab") {
        await browser.tabs.create({
          url: await browser.runtime.getURL("ui.html"),
        });
      } else if (info.menuItemId === "open-as-window") {
        await this.openPopupWindow();
      } else if (
        (addressActivityTool = parseEnum(
          ActivityToolId,
          stripPrefix(String(info.menuItemId), activityIdPrefix),
        ))
      ) {
        this.setMenuState({ addressActivityTool });
      } else if (
        (addressCollectablesTool = parseEnum(
          CollectablesToolId,
          stripPrefix(String(info.menuItemId), collectablesIdPrefix),
        ))
      ) {
        this.setMenuState({ addressCollectablesTool });
      }
    })().catch((e) => {
      log.error("onContextMenuClick failed to handle click:", info, e);
    });
  }

  private async openPopupWindow(): Promise<void> {
    const window = await browser.windows.getCurrent();
    const curLeft = Number(window.left);
    const curWidth = Number(window.width);
    const curTop = Number(window.top);
    const curHeight = Number(window.height);

    const margin = Math.round(Math.min(curWidth * 0.1, curHeight * 0.1));
    let dimensions = {
      width: curWidth - margin * 2,
      height: curHeight - margin * 2,
      left: curLeft + margin,
      top: curTop + margin,
    } as const;

    if (Object.values(dimensions).some((n) => Number.isNaN(n))) {
      dimensions = { width: 512, left: 256, height: 512, top: 256 };
    }

    await browser.windows.create({
      type: "popup",
      url: await browser.runtime.getURL("ui.html"),
      ...dimensions,
    });
  }

  /**
   * Options >
   *    Address Tool #1 >
   *      Blockscan
   *      Debank
   *      Nansen (Poor Polygon support)
   *      Zapper (Poor Polygon support)
   *      ------------
   *      OpenSea
   *      OpenSea Pro
   *      RCAX
   *      FirstMate
   *      AvatarDex
   *   Address Tool #2
   *
   * Options >
   *    Address Activity Tool >
   *      Blockscan
   *      Debank
   *      Nansen (Poor Polygon support)
   *      Zapper (Poor Polygon support)
   *      https://platform.arkhamintelligence.com/explorer/address/0xd2A2B709af3B6d0bba1cCbd1edD65f353aA42C66
   *    Address Collectables Tool >
   *      OpenSea
   *      OpenSea Pro
   *      RCAX
   *      FirstMate
   *      AvatarDex
   *      https://magiceden.io/u/0x53f4efab3205d95a05574e05ea9f335dc48d7731?chain=polygon
   *      https://rarible.com/user/0x53f4efab3205d95a05574e05ea9f335dc48d7731/owned
   *
   */

  #isStarted: boolean = false;
  start() {
    if (this.#isStarted) return;
    this.#isStarted = true;

    browser.contextMenus.removeAll();

    const createProps = menus.flatMap((e) => getCreateProps(e, undefined));
    log.debug("createProps", createProps);
    for (const props of createProps) {
      browser.contextMenus.create(props);
    }

    browser.contextMenus.onClicked.addListener(this.onContextMenuClick);
  }

  stop() {
    if (!this.#isStarted) return;
    this.#isStarted = false;
    browser.contextMenus.removeAll();
    browser.contextMenus.onClicked.removeListener(this.onContextMenuClick);
  }
}

export function bindActionContextMenuToSettingsStore({
  contextMenu,
  settingsStore,
  sync,
}: {
  contextMenu: ActionContextMenu;
  settingsStore: VaultonomyUserPreferencesStore;
  sync?: "from-settings";
}): Stop {
  const onStop: Stop[] = [];

  onStop.push(
    contextMenu.emitter.on(
      "menuStateChanged",
      (menuState: Partial<ContextMenuState>) => {
        settingsStore.setProperties(menuState).catch((e) => {
          log.error("failed to persist options from action context menu", e);
        });
      },
    ),
  );

  const syncMenuFromSettings = (
    settings: Partial<VaultonomyUserPreferences>,
  ) => {
    contextMenu.setMenuState(settings);
  };

  onStop.push(
    settingsStore.emitter.on("propertiesChanged", syncMenuFromSettings),
  );

  if (sync === "from-settings") {
    settingsStore
      .getProperties()
      .then(syncMenuFromSettings)
      .catch((e) => {
        log.error("failed sync context menu from settings on startup", e);
      });
  }

  return () => onStop.forEach((stop) => stop());
}
