import { JSONRPCServer, JSONRPCServerAndClient } from "json-rpc-2.0";
import { Emitter, createNanoEvents } from "nanoevents";

import { assertUnreachable } from "../../assert";
import { RedditProvider } from "../../reddit/reddit-interaction-client";
import {
  Connector,
  ManagedConnection,
  ReconnectingManagedConnection,
  mapConnection,
} from "../../rpc/connections";
import { createRCPMethodCaller } from "../../rpc/typing";
import { createJSONRPCServerAndClientPortConnector } from "../../rpc/webextension-port-json-rpc";
import {
  RedditTabAvailability,
  VaultonomyGetRedditTabAvailability,
  VaultonomyUiNotify,
} from "../../vaultonomy-rpc-spec";

export type RedditTabBecameAvailableEvent = {
  type: "redditTabBecameAvailable";
  redditProvider: RedditProvider;
};
export type RedditTabBecameUnavailableEvent = {
  type: "redditTabBecameUnavailable";
};
export interface RedditTabConnectionEvents {
  availabilityStatus: (
    event: RedditTabBecameAvailableEvent | RedditTabBecameUnavailableEvent,
  ) => void;
}

export class VaultonomyBackgroundProvider {
  readonly emitter: Emitter<RedditTabConnectionEvents> = createNanoEvents();

  private readonly managedServerAndClient: ManagedConnection<JSONRPCServerAndClient>;
  public readonly redditProvider: RedditProvider;
  private redditWasAvailableOnLastUpdate: boolean | undefined = undefined;

  constructor(portConnector: Connector<chrome.runtime.Port>) {
    this.managedServerAndClient =
      new ReconnectingManagedConnection<JSONRPCServerAndClient>(
        createJSONRPCServerAndClientPortConnector({
          portConnector,
          createServer: this.createServer.bind(this),
        }),
      );

    const managedClient = mapConnection(
      this.managedServerAndClient,
      (sc) => sc.client,
    );

    this.getRedditTabAvailability = createRCPMethodCaller({
      method: VaultonomyGetRedditTabAvailability,
      managedClient,
    });

    this.redditProvider = new RedditProvider(managedClient);
  }

  get isRedditAvailable(): boolean {
    return !!this.redditWasAvailableOnLastUpdate;
  }

  private createServer(): JSONRPCServer {
    const server = new JSONRPCServer({ errorListener: () => undefined });

    server.addMethod(
      VaultonomyUiNotify.name,
      VaultonomyUiNotify.signature.implement(async (event) => {
        switch (event.type) {
          case "redditTabBecameAvailable":
            this.redditWasAvailableOnLastUpdate = true;
            this.emitter.emit("availabilityStatus", {
              type: "redditTabBecameAvailable",
              redditProvider: this.redditProvider,
            });
            break;
          case "redditTabBecameUnavailable":
            this.redditWasAvailableOnLastUpdate = false;
            this.emitter.emit("availabilityStatus", {
              type: "redditTabBecameUnavailable",
            });
            break;
          default:
            assertUnreachable(event);
        }
        return null;
      }),
    );

    return server;
  }

  /**
   * This is protected as it seems unlikely that the UI needs to call it directly.
   */
  protected readonly getRedditTabAvailability: () => Promise<RedditTabAvailability>;

  async requestAvailabilityStatus(): Promise<
    RedditTabBecameAvailableEvent | RedditTabBecameUnavailableEvent
  > {
    const { available } = await this.getRedditTabAvailability();
    let event: RedditTabBecameAvailableEvent | RedditTabBecameUnavailableEvent;
    if (available) {
      event = {
        type: "redditTabBecameAvailable",
        redditProvider: this.redditProvider,
      };
    } else {
      event = { type: "redditTabBecameUnavailable" };
    }
    this.emitter.emit("availabilityStatus", event);
    return event;
  }

  disconnect(): void {
    this.managedServerAndClient.disconnect();
  }
}
