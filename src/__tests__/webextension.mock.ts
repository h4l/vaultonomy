import { jest } from "@jest/globals";
import { nextTick } from "process";
import util from "util";

import { retroactivePortDisconnection } from "../webextensions/retroactivePortDisconnection";

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

  readonly name: string;
  constructor(options?: {
    name?: string;
    sender?: chrome.runtime.MessageSender;
    sendPostedMessage?: MockPortSendMessage;
    sendDisconnect?: MockPortSendDisconnect;
  }) {
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
      throw new Error("Attempted to disconnect a disconnected Port");
    }
    this.#isDisconnected = true;
    nextTick(() => this.#sendDisconnect(this));
  }

  toString(): string {
    return `MockPort(${util.inspect({
      name: this.name,
      sender: this.sender,
    })})`;
  }
}
