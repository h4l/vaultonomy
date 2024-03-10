import { JSONRPCServer, JSONRPCServerAndClient } from "json-rpc-2.0";
import { Emitter, createNanoEvents } from "nanoevents";

import { assertUnreachable } from "../../assert";
import {
  AnyRedditProviderError,
  RedditProvider,
  RedditProviderError,
} from "../../reddit/reddit-interaction-client";
import { ErrorCode } from "../../reddit/reddit-interaction-spec";
import {
  Connector,
  ManagedConnection,
  ReconnectingManagedConnection,
  mapConnection,
} from "../../rpc/connections";
import { createRCPMethodCaller } from "../../rpc/typing";
import { createJSONRPCServerAndClientPortConnector } from "../../rpc/webextension-port-json-rpc";
import { Unbind } from "../../types";
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
  private stopObservingRedditRequestOutcomes: Unbind;

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

    const getRedditTabAvailability = createRCPMethodCaller({
      method: VaultonomyGetRedditTabAvailability,
      managedClient,
    });
    this.getRedditTabAvailability = () => getRedditTabAvailability(null);

    this.redditProvider = new RedditProvider(managedClient);

    // This is a complementary method of inferring Reddit connectivity to the
    // vaultonomyUi_notify requests. Mostly this shouldn't have any effect, as
    // the notifications should pre-empt actual request failures and successes,
    // but there may be edge cases where we can't connect to a Reddit tab, e.g.
    // if the injected content script has failed for some reason.
    this.stopObservingRedditRequestOutcomes =
      this.inferRedditAvailabilityFromRequestOutcomes();
  }

  get isRedditAvailable(): boolean {
    return !!this.redditWasAvailableOnLastUpdate;
  }

  /**
   * Detect whether a Reddit tab is connected by observing RedditProvider
   * interactions.
   */
  private inferRedditAvailabilityFromRequestOutcomes(): Unbind {
    const unbindRequestFailed = this.redditProvider.emitter.on(
      "requestFailed",
      (error: AnyRedditProviderError) => {
        if (error instanceof RedditProviderError) {
          if (error.type === ErrorCode.REDDIT_TAB_DISCONNECTED) {
            this.markRedditUnavailable();
          } else {
            // Any other ErrorCode indicates our request got to a reddit tab and
            // failed for another reason.
            this.markRedditAvailable();
          }
        }
        // This is an UnknownRedditProviderError which could be anything and we
        // can't infer whether a tab is connected or not.
      },
    );
    const unbindRequestSucceeded = this.redditProvider.emitter.on(
      "requestSucceeded",
      () => this.markRedditAvailable(),
    );

    return () => {
      unbindRequestFailed();
      unbindRequestSucceeded();
    };
  }

  private markRedditAvailable(): void {
    if (this.redditWasAvailableOnLastUpdate === true) return;
    this.redditWasAvailableOnLastUpdate = true;
    this.emitter.emit("availabilityStatus", {
      type: "redditTabBecameAvailable",
      redditProvider: this.redditProvider,
    });
  }

  private markRedditUnavailable(): void {
    if (this.redditWasAvailableOnLastUpdate === false) return;
    this.redditWasAvailableOnLastUpdate = false;
    this.emitter.emit("availabilityStatus", {
      type: "redditTabBecameUnavailable",
    });
  }

  private createServer(): JSONRPCServer {
    const server = new JSONRPCServer({ errorListener: () => undefined });

    server.addMethod(
      VaultonomyUiNotify.name,
      VaultonomyUiNotify.signature.implement(async (event) => {
        switch (event.type) {
          case "redditTabBecameAvailable":
            this.markRedditAvailable();
            break;
          case "redditTabBecameUnavailable":
            this.markRedditUnavailable();
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

  async requestAvailabilityStatus(): Promise<void> {
    const { available } = await this.getRedditTabAvailability();
    if (available) this.markRedditAvailable();
    else this.markRedditUnavailable();
  }

  disconnect(): void {
    this.managedServerAndClient.disconnect();
    this.stopObservingRedditRequestOutcomes();
  }
}
