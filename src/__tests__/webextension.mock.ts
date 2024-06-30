import { jest } from "@jest/globals";
import { FunctionLike, Mock } from "jest-mock";
import { mock } from "jest-mock-extended";
import { nextTick } from "process";
import util from "util";

import { log } from "../logging";
import { Connector } from "../rpc/connections";
import { RecursivePartial } from "../types";
import {
  StorageAreaClear,
  StorageAreaGetSetRemove,
  WebExtensionAPI,
} from "../webextension";
import { createRawPortConnector } from "../webextensions/createRawPortConnector";
import { retroactivePortDisconnection } from "../webextensions/retroactivePortDisconnection";
import { nextTickPromise } from "./testing.utils";

function unimplementedMockFn<T extends FunctionLike>() {
  const mock = jest.fn<T>(((): any => {
    throw new Error("Mocked without implementation");
  }) as T);
  return mock;
}

/**
 * Store state for a mock that is reset when jest.clearAllMocks() is called.
 *
 * @param initial The initial value after clearAllMocks().
 * @returns A function that returns the current state.
 */
function mockState<T extends Record<string | number | symbol, any>>(
  initial: T | (() => T),
): () => T {
  const stateCarrier = jest.fn<(this: T) => void>();
  return (): T => {
    if (stateCarrier.mock.contexts.length === 0) {
      stateCarrier.call(
        typeof initial === "function" ? initial() : { ...initial },
      );
    }
    return stateCarrier.mock.contexts[0];
  };
}

function escapeRegex(string: string): string {
  return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
}

function matchGlob(pattern: string, value: string): boolean {
  if (!pattern.includes("*")) return pattern === value;
  return new RegExp(pattern.split("*").map(escapeRegex).join(".*")).test(value);
}

const sensitiveTabField = /^(?:url|pendingUrl|title|favIconUrl)$/;

function queryMatchesTab(
  query: chrome.tabs.QueryInfo,
  tab: chrome.tabs.Tab,
): "sensitive-match" | "unsensitive-match" | "no-match" {
  let result: "sensitive-match" | "unsensitive-match" = "unsensitive-match";
  for (const [key, value] of Object.entries(query)) {
    if (key === "url") {
      const url = tab.url;
      if (value === undefined || url === undefined) return "no-match";
      if (Array.isArray(value)) {
        if (!value.some((v) => matchGlob(v, url))) return "no-match";
      } else if (!matchGlob(String(value), url)) return "no-match";
    } else if (
      value !== undefined &&
      tab[key as keyof chrome.tabs.Tab] !== value
    ) {
      return "no-match";
    }
    if (sensitiveTabField.test(key)) result = "sensitive-match";
  }
  return result;
}

export const activeTabAccessible = Symbol("activeTabAccessible");

export function markActiveTabAccessible(
  options: chrome.tabs.CreateProperties,
  accessible: boolean = true,
): chrome.tabs.CreateProperties {
  (options as any)[activeTabAccessible] = accessible;
  return options;
}

export function isActiveTabAccessible(tab: chrome.tabs.Tab): boolean {
  return !!(activeTabAccessible in tab && tab[activeTabAccessible]);
}

function getTabsMock(thisMock: ThisMock): RecursivePartial<typeof chrome.tabs> {
  type OnUpdatedEvent = EventEmitter<
    [tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab]
  >;
  type OnRemovedEvent = EventEmitter<
    [tabId: number, removeInfo: chrome.tabs.TabRemoveInfo]
  >;
  type TabState = {
    nextId: number;
    tabs: Map<number, chrome.tabs.Tab>;
    onUpdated: OnUpdatedEvent;
    onRemoved: OnRemovedEvent;
  };
  const state = mockState<TabState>(
    (): TabState => ({
      nextId: 9000,
      tabs: new Map(),
      onUpdated: new EventEmitter(),
      onRemoved: new EventEmitter(),
    }),
  );

  function mockTab(
    options: chrome.tabs.CreateProperties,
  ): ReturnType<typeof mock<chrome.tabs.Tab>> {
    const tab = mock<chrome.tabs.Tab>({ id: state().nextId++, ...options });
    state().tabs.set(tab.id!, tab);
    return tab;
  }

  async function canAccess(
    tab: chrome.tabs.Tab,
    hasActiveTabPermission?: boolean,
  ): Promise<boolean> {
    if (isActiveTabAccessible(tab)) {
      if (hasActiveTabPermission === undefined)
        hasActiveTabPermission = await thisMock().permissions.contains({
          permissions: ["activeTab"],
        });
      if (hasActiveTabPermission) return true;
    }
    return (
      tab.url !== undefined &&
      (await thisMock().permissions.contains({
        permissions: ["tabs"],
        origins: [tab.url],
      }))
    );
  }

  function censorTab(tab: chrome.tabs.Tab): void {
    delete tab.url;
    delete tab.favIconUrl;
    delete tab.pendingUrl;
    delete tab.title;
  }

  /** Partial implementation of browser.tabs.update()
   *
   * This implementation only supports changing the url.
   */
  async function update(
    ...args:
      | [updateProperties: chrome.tabs.UpdateProperties | undefined]
      | [
          tabId: number | undefined,
          updateProperties: chrome.tabs.UpdateProperties | undefined,
        ]
  ): Promise<undefined | chrome.tabs.Tab> {
    await nextTickPromise();

    let tabId: number | undefined;
    let updateProperties: chrome.tabs.UpdateProperties = {};
    // tabId should default to the current window's selected tab, but we don't
    // track this in the mock.
    if (args.length === 1) {
      if (typeof args[0] === "number") tabId = args[0];
      else updateProperties = args[0] ?? {};
    } else {
      tabId = args[0];
      updateProperties = args[1] ?? {};
    }

    // We only implement support for the url prop, because that's sufficient
    // for our tests.
    const { url, ...others } = updateProperties;
    if (Object.entries(others).length > 0) {
      log.error(
        "browser.tabs.update() called with properties that the mock does not handle:",
        others,
      );
    }

    if (tabId === undefined) return;
    const tab = state().tabs.get(tabId);
    if (!tab) return;

    const props: Partial<chrome.tabs.Tab> = {
      ...(url === undefined ? {} : { url }),
    };

    const hasActiveTabPermission = await thisMock().permissions.contains({
      permissions: ["activeTab"],
    });

    let tabChanged = false;
    for (const key of Object.keys(props) as Array<keyof chrome.tabs.Tab>) {
      if (props[key] !== tab[key]) {
        tabChanged = true;
        break;
      }
    }

    const originalTab = { ...tab };
    Object.assign(tab, props);
    const outputTab = { ...tab };

    // We check permissions after updating because don't require access to change a tab's
    // URL, only to read it
    if (!(await canAccess(tab, hasActiveTabPermission))) censorTab(outputTab);

    const changes: chrome.tabs.TabChangeInfo = {};
    if (originalTab.url !== tab.url) {
      changes.url = outputTab.url; // may be censored to undefined
    }

    if (tabChanged) {
      state().onUpdated.emit(tabId, changes, outputTab);
    }

    return outputTab;
  }

  return {
    get onUpdated() {
      return state().onUpdated;
    },
    get onRemoved() {
      return state().onRemoved;
    },
    get: jest.fn(async (id: number) => {
      const tab = state().tabs.get(id);
      if (!tab) throw new Error(`No tab with id: ${id}`);

      const resultTab = { ...tab };
      if (!(await canAccess(tab))) censorTab(resultTab);
      return resultTab;
    }),
    create: jest.fn<typeof chrome.tabs.create>(async (opt) => {
      return mockTab(opt);
    }),
    update: jest.fn<typeof chrome.tabs.update>(
      update as typeof chrome.tabs.update,
    ),
    query: jest.fn<typeof chrome.tabs.query>(
      async (query: chrome.tabs.QueryInfo) => {
        const matches = [...state().tabs.values()].map((tab) => ({
          tab,
          match: queryMatchesTab(query, tab),
        }));

        const permittedTabs: chrome.tabs.Tab[] = [];
        const hasActiveTabPermission = await thisMock().permissions.contains({
          permissions: ["activeTab"],
        });

        for (const { tab, match } of matches) {
          if (match === "no-match") continue;

          // This is simplistic, but good enough for testing (in reality the
          // active flag doesn't control whether an extension with activeTab
          // permission can access it, tabs are not accessible without
          // user-interaction, and inactive tabs remain accessible).
          const canRead = await canAccess(tab, hasActiveTabPermission);
          if (match === "sensitive-match" && !canRead) continue;

          // The match does not depend on a sensitive field, but we censor its
          // fields if we lack access to it.
          const resultTab = { ...tab };
          if (!canRead) {
            censorTab(resultTab);
          }

          permittedTabs.push(resultTab);
        }
        return permittedTabs;
      },
    ),
    remove: jest.fn(async (tabIds: number | number[]): Promise<void> => {
      await nextTickPromise();
      const tabs = state().tabs;
      if (typeof tabIds === "number") tabIds = [tabIds];

      for (const id of tabIds) {
        const tab = tabs.get(id);
        tabs.delete(id);
        if (tab) {
          state().onRemoved.emit(id, {
            isWindowClosing: false,
            windowId: tab.windowId,
          });
        }
      }
    }),
    discard: jest.fn(async (tabId?: number): Promise<void> => {
      if (tabId === undefined) {
        for (const tab of state().tabs.values()) {
          if (!tab.active && !tab.discarded) {
            tab.discarded = true;
            return;
          }
        }
      } else {
        const tab = state().tabs.get(tabId);
        if (tab && !tab.active) tab.discarded = true;
      }
    }),
    connect: jest.fn(
      (
        _tabId: number,
        connectInfo?: chrome.runtime.ConnectInfo,
      ): chrome.runtime.Port => {
        return new MockPort({ name: connectInfo?.name }) as chrome.runtime.Port;
      },
    ),
  };
}

function getWindowsMock(): RecursivePartial<typeof chrome.windows> {
  type WindowsState = {
    nextId: number;
    windows: Map<number, chrome.windows.Window>;
  };
  const state = mockState<WindowsState>(() => ({
    nextId: 1,
    windows: new Map(),
  }));

  return {
    get: jest.fn(
      async (windowId: number, query?: any): Promise<chrome.windows.Window> => {
        if (query !== undefined)
          throw new Error("windows.get() with query is not implemented");
        const window = state().windows.get(windowId);
        if (!window) throw new Error(`No window with id: ${windowId}`);
        return window;
      },
    ),
    getCurrent: jest.fn(async (): Promise<chrome.windows.Window> => {
      // Use focussed as a proxy for current — good enough for testing
      for (const window of state().windows.values()) {
        if (window.focused) return window;
      }
      throw new Error("No window is current");
    }),
    create: jest.fn(
      async ({
        focused = false,
        incognito = false,
        ...createData
      }: chrome.windows.CreateData = {}): Promise<chrome.windows.Window> => {
        const window: chrome.windows.Window = {
          id: state().nextId++,
          alwaysOnTop: false,
          focused,
          incognito,
          ...(createData ?? {}),
        };
        state().windows.set(window.id!, window);
        return window;
      },
    ),
    remove: jest.fn(async (windowId: number): Promise<void> => {
      state().windows.delete(windowId);
    }),
  };
}

function getPermissionsMock(): RecursivePartial<typeof chrome.permissions> {
  type PermissionsState = {
    permissions: Map<string, null | Set<string>>;
  };
  const state = mockState<PermissionsState>(() => ({ permissions: new Map() }));

  return {
    contains: jest.fn(
      async (requested: chrome.permissions.Permissions): Promise<boolean> => {
        const { permissions } = state();
        // I'm not sure what the behaviour is for this as the docs aren't
        // specific.
        for (const permission of requested.permissions ?? []) {
          const allowedOrigins = permissions.get(permission);
          if (allowedOrigins === undefined) return false;
          // Permissions without origin lists are assumed to be global
          if (allowedOrigins === null) continue;

          for (const origin of requested.origins ?? []) {
            let allowed = false;
            for (const allowedOrigin of allowedOrigins) {
              if (matchGlob(allowedOrigin, origin)) {
                allowed = true;
                break;
              }
            }
            if (!allowed) return false;
          }
        }
        return true;
      },
    ),
    request: jest.fn(
      async (requested: chrome.permissions.Permissions): Promise<boolean> => {
        const { permissions } = state();
        for (const permission of requested.permissions ?? []) {
          let origins = permissions.get(permission);
          if (!origins) {
            origins = new Set();
            permissions.set(permission, origins);
          }
          for (const origin of requested.origins ?? []) origins.add(origin);
        }
        return true;
      },
    ),
  };
}

function getScriptingMock(): RecursivePartial<typeof chrome.scripting> {
  return {
    executeScript: jest.fn(
      async <Args extends any[], Result>(
        _injection: chrome.scripting.ScriptInjection<Args, Result>,
      ): Promise<Array<chrome.scripting.InjectionResult<Awaited<Result>>>> => {
        throw new Error("Mock has no default implementation");
      },
    ),
  };
}

function getDefaultWebextensionMock(
  thisMock: ThisMock,
): RecursivePartial<typeof chrome> {
  return {
    action: {
      onClicked: new EventEmitter(),
    },
    storage: {
      session: new MockStorage(),
    },
    tabs: getTabsMock(thisMock),
    runtime: {},
    windows: getWindowsMock(),
    permissions: getPermissionsMock(),
    scripting: getScriptingMock(),
  };
}

type ThisMock = () => WebExtensionAPI;

export function installWebextensionMock(
  customize?: (
    browser?: RecursivePartial<WebExtensionAPI>,
  ) => RecursivePartial<WebExtensionAPI>,
) {
  const thisMock = () => browser as WebExtensionAPI;
  let browser = getDefaultWebextensionMock(thisMock);
  if (customize) browser = customize(browser);

  jest.unstable_mockModule<typeof import("../webextension")>(
    "./src/webextension",
    () => ({ browser: browser as WebExtensionAPI }),
  );
}

export function mockedEvent<EventArgs extends unknown[]>(
  event: chrome.events.Event<Callback<EventArgs>>,
): EventEmitter<EventArgs> {
  if (event instanceof EventEmitter) return event;
  throw new Error(`value is not an EventEmitter mock instance: ${event}`);
}

type Callback<EventArgs extends unknown[]> = (...args: EventArgs) => void;

export class EventEmitter<EventArgs extends unknown[]>
  implements chrome.events.Event<Callback<EventArgs>>
{
  #listeners: Set<Callback<EventArgs>>;
  constructor() {
    this.#listeners = new Set();
    jest.spyOn(this as EventEmitter<EventArgs>, "emit");
    jest.spyOn(this as EventEmitter<EventArgs>, "addListener");
    jest.spyOn(this as EventEmitter<EventArgs>, "hasListener");
    jest.spyOn(this as EventEmitter<EventArgs>, "removeListener");
    jest.spyOn(this as EventEmitter<EventArgs>, "hasListeners");
  }
  addRules = jest.fn().mockImplementation(() => {
    throw new Error("not implemented");
  });
  removeRules = jest.fn().mockImplementation(() => {
    throw new Error("not implemented");
  });
  getRules = jest.fn().mockImplementation(() => {
    throw new Error("not implemented");
  });

  emit(...args: EventArgs): void {
    for (const listener of this.#listeners) {
      listener(...args);
    }
  }

  addListener(callback: Callback<EventArgs>): void {
    this.#listeners.add(callback);
  }
  hasListener(callback: Callback<EventArgs>): boolean {
    return this.#listeners.has(callback);
  }
  removeListener(callback: Callback<EventArgs>): void {
    this.#listeners.delete(callback);
  }
  hasListeners(): boolean {
    return this.#listeners.size > 0;
  }
}

export type MockPortSendMessage = (message: unknown, port: MockPort) => void;
export type MockPortSendDisconnect = (port: MockPort) => void;
export type MockPortConnector = Connector<MockPort> & {
  port: MockPort | undefined;
};

/** A mock implementation of the WebExtension Port API.
 *
 * This simulates a single end of a Port connection. Use the receiveMessage and
 * receiveDisconnect methods to simulate messages from the other end, and the
 * sendPostedMessage and sendDisconnect constructor options to send messages to
 * the other end.
 */
export class MockPort implements chrome.runtime.Port {
  #isDisconnected = false;
  #onDisconnect: EventEmitter<[chrome.runtime.Port]> = new EventEmitter();
  #onMessage: EventEmitter<[unknown, chrome.runtime.Port]> = new EventEmitter();
  #sendPostedMessage: MockPortSendMessage;
  #sendDisconnect: MockPortSendDisconnect;
  onDisconnect: chrome.runtime.PortDisconnectEvent = this.#onDisconnect;
  onMessage: chrome.runtime.PortMessageEvent = this.#onMessage;
  sender?: chrome.runtime.MessageSender | undefined;
  #allowDisconnectAfterDisconnect: boolean;

  readonly name: string;
  constructor(options?: {
    name?: string;
    sender?: chrome.runtime.MessageSender;
    sendPostedMessage?: MockPortSendMessage;
    sendDisconnect?: MockPortSendDisconnect;
    allowDisconnectAfterDisconnect?: boolean;
  }) {
    this.#allowDisconnectAfterDisconnect =
      options?.allowDisconnectAfterDisconnect ?? true;
    this.name = options?.name ?? "Unnamed MockPort";
    this.sender = options?.sender;
    this.#sendPostedMessage = options?.sendPostedMessage ?? (() => undefined);
    this.#sendDisconnect = options?.sendDisconnect ?? (() => undefined);
    jest.spyOn(this as MockPort, "postMessage");
    jest.spyOn(this as MockPort, "disconnect");
  }

  /**
   * Create a new MockPort that's registered for retroactive disconnection detection.
   */
  static createAndRegisterRetroactiveDisconnection(): MockPort {
    const mockPort = new MockPort();
    retroactivePortDisconnection.register(mockPort);
    return mockPort;
  }

  static createMockConnector(): [
    Mock<Connector<chrome.runtime.Port>>,
    MockPort,
  ] {
    let mockPort: MockPort =
      MockPort.createAndRegisterRetroactiveDisconnection();

    const connector = jest
      .fn<Connector<chrome.runtime.Port>>()
      .mockImplementation(() => {
        throw new Error(
          "createMockConnector(): tried to connect more than once",
        );
      })
      .mockImplementationOnce(createRawPortConnector(() => mockPort));

    return [connector, mockPort];
  }

  receiveMessage(message: unknown): void {
    if (this.#isDisconnected) {
      throw new Error("Attempted to receiveMessage on a disconnected Port");
    }
    nextTick(() => this.#onMessage.emit(message, this));
  }

  receiveDisconnect(): void {
    if (this.#isDisconnected) {
      throw new Error("Attempted to receiveDisconnect on a disconnected Port");
    }
    this.#isDisconnected = true;
    nextTick(() => this.#onDisconnect.emit(this));
  }

  postMessage(message: unknown): void {
    if (this.#isDisconnected) {
      throw new Error("Attempted to postMessage on a disconnected Port");
    }
    nextTick(() => this.#sendPostedMessage(message, this));
  }
  disconnect(): void {
    // Note that disconnect() does not emit an event on OUR onDisconnect.
    if (this.#isDisconnected) {
      if (this.#allowDisconnectAfterDisconnect) return;
      throw new Error("Attempted to disconnect a disconnected Port");
    }
    this.#isDisconnected = true;
    nextTick(() => this.#sendDisconnect(this));
  }

  get isDisconnected(): boolean {
    return this.#isDisconnected;
  }

  toString(): string {
    return `MockPort(${util.inspect({
      name: this.name,
      sender: this.sender,
    })})`;
  }
}

export class MockStorage
  implements StorageAreaGetSetRemove, StorageAreaClear, StorageAreaGetSetRemove
{
  private readonly storage = new Map<string, string>();

  mockClear(): void {
    this.storage.clear();
  }

  async set(items: { [key: string]: any }): Promise<void> {
    await nextTickPromise();
    for (const key in items) {
      const value = items[key];
      if (value !== undefined) {
        this.storage.set(key, JSON.stringify(value));
      }
    }
  }
  async get(
    keys?: string | string[] | { [key: string]: any } | null | undefined,
  ): Promise<{ [key: string]: any }> {
    await nextTickPromise();
    if (keys === null || keys === undefined) return {};
    const values =
      typeof keys === "string" ? { [keys]: undefined }
      : Array.isArray(keys) ?
        Object.fromEntries(keys.map((key) => [key, undefined]))
      : { ...keys };
    for (const key in values) {
      const value = this.storage.get(key);
      if (value !== undefined) values[key] = JSON.parse(value);
      if (value === undefined) delete values[key];
    }
    return values;
  }

  async remove(keys: string | string[]): Promise<void> {
    await nextTickPromise();
    if (typeof keys === "string") {
      this.storage.delete(keys);
    } else {
      for (const key of keys) {
        this.storage.delete(key);
      }
    }
  }

  async clear(): Promise<void> {
    await nextTickPromise();
    this.storage.clear();
  }
}
