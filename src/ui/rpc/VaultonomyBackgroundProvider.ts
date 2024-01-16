import {
  JSONRPCClient,
  JSONRPCServer,
  JSONRPCServerAndClient,
} from "json-rpc-2.0";
import { Emitter, createNanoEvents } from "nanoevents";

import { assertUnreachable } from "../../assert";
import { RedditProvider } from "../../reddit/reddit-interaction-client";
import { createRCPMethodCaller } from "../../rpc/typing";
import {
  bindPortToJSONRPCServerAndClient,
  createPortSendRequestFn,
} from "../../rpc/webextension-port-json-rpc";
import {
  RedditTabAvailability,
  VaultonomyGetRedditTabAvailability,
  VaultonomyUiNotify,
} from "../../vaultonomy-rpc-spec";
import { retroactivePortDisconnection } from "../../webextensions/retroactivePortDisconnection";

type Unbind = () => void;

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

  private readonly jsonrpc: JSONRPCServerAndClient;
  private readonly unbindFromPort: Unbind;
  private readonly redditProvider: RedditProvider;

  constructor(private readonly port: chrome.runtime.Port) {
    this.jsonrpc = this.createServerAndClient(port);
    this.unbindFromPort = bindPortToJSONRPCServerAndClient({
      port,
      serverAndClient: this.jsonrpc,
    });

    this.getRedditTabAvailability = createRCPMethodCaller({
      method: VaultonomyGetRedditTabAvailability,
      client: this.jsonrpc.client,
    });

    this.redditProvider = new RedditProvider({
      redditInteractionClient: this.jsonrpc.client,
    });

    // Our RedditProvider doesn't register any event listeners, so we don't
    // really need to disconnect it. But seems like we should for completeness,
    // seeing as it has an emitter with a disconnected event.
    retroactivePortDisconnection.addRetroactiveDisconnectListener(port, () => {
      this.redditProvider.emitter.emit("disconnected");
    });
  }

  private createServerAndClient(
    port: chrome.runtime.Port,
  ): JSONRPCServerAndClient {
    return new JSONRPCServerAndClient(
      this.createServer(),
      this.createClient(port),
    );
  }

  private createServer(): JSONRPCServer {
    const server = new JSONRPCServer({ errorListener: () => undefined });

    server.addMethod(
      VaultonomyUiNotify.name,
      VaultonomyUiNotify.signature.implement(async (event) => {
        switch (event.type) {
          case "redditTabBecameAvailable":
            this.emitter.emit("availabilityStatus", {
              type: "redditTabBecameAvailable",
              redditProvider: this.redditProvider,
            });
            break;
          case "redditTabBecameUnavailable":
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

  private createClient(port: chrome.runtime.Port): JSONRPCClient {
    const client = new JSONRPCClient(createPortSendRequestFn(port));
    return client;
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
    this.unbindFromPort();
    this.port.disconnect();
  }
}
