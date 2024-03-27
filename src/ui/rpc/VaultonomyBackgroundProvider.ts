import { JSONRPCServer, JSONRPCServerAndClient } from "json-rpc-2.0";
import { Emitter, createNanoEvents } from "nanoevents";

import { assertUnreachable } from "../../assert";
import { log as _log } from "../../logging";
import {
  BackgroundServiceStartedEvent,
  UserLinkInteractionEvent,
  UserPageInteractionEvent,
} from "../../messaging";
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
import { Stop, Unbind } from "../../types";
import {
  RedditTabAvailability,
  TaggedVaultonomyBackgroundEvent,
  VaultonomyGetRedditTabAvailability,
  VaultonomyGetSettings,
  VaultonomyGetUiNotifications,
  VaultonomySettings,
  VaultonomyUiNotify,
} from "../../vaultonomy-rpc-spec";
import { browser } from "../../webextension";
import { SynchronisingEventEmitter } from "./SynchronisingEventEmitter";

const log = _log.getLogger("ui/rpc/VaultonomyBackgroundProvider");

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
  userLinkInteraction: (event: UserLinkInteractionEvent) => void;
  userPageInteraction: (event: UserPageInteractionEvent) => void;
}

export class VaultonomyBackgroundProvider {
  readonly emitter: Emitter<RedditTabConnectionEvents> = createNanoEvents();

  private readonly managedServerAndClient: ManagedConnection<JSONRPCServerAndClient>;
  public readonly redditProvider: RedditProvider;
  private synchronisingEventEmitter: SynchronisingEventEmitter<TaggedVaultonomyBackgroundEvent>;
  private toStop: Stop[] = [];

  constructor(portConnector: Connector<chrome.runtime.Port>) {
    this.managedServerAndClient =
      new ReconnectingManagedConnection<JSONRPCServerAndClient>(
        createJSONRPCServerAndClientPortConnector({
          portConnector,
          createServer: this.createServer.bind(this),
        }),
      );
    this.toStop.push(() => this.managedServerAndClient.stop());

    const managedClient = mapConnection(
      this.managedServerAndClient,
      (sc) => sc.client,
    );

    const getRedditTabAvailability = createRCPMethodCaller({
      method: VaultonomyGetRedditTabAvailability,
      managedClient,
    });
    this.getRedditTabAvailability = () => getRedditTabAvailability(null);

    const getUiNotifications = createRCPMethodCaller({
      method: VaultonomyGetUiNotifications,
      managedClient,
    });
    this.getUiNotifications = () => getUiNotifications(null);

    const getSettings = createRCPMethodCaller({
      method: VaultonomyGetSettings,
      managedClient,
    });
    this.getSettings = () => getSettings(null);

    this.redditProvider = new RedditProvider({
      managedClient,
      stopManagedClientOnDisconnect: false,
    });

    // This is a complementary method of inferring Reddit connectivity to the
    // vaultonomyUi_notify requests. Mostly this shouldn't have any effect, as
    // the notifications should pre-empt actual request failures and successes,
    // but there may be edge cases where we can't connect to a Reddit tab, e.g.
    // if the injected content script has failed for some reason.
    this.toStop.push(this.inferRedditAvailabilityFromRequestOutcomes());

    this.synchronisingEventEmitter = new SynchronisingEventEmitter({
      getEventLog: async () => this.getUiNotifications(),
      emitEvent: (event) => {
        event.event.type === "userLinkInteraction" ?
          this.emitter.emit(event.event.type, event.event)
        : this.emitter.emit(event.event.type, event.event);
      },
    });

    this.toStop.push(this.startListeningForBackgroundServiceStarted());
  }

  private startListeningForBackgroundServiceStarted(): Stop {
    const onMessage = (message: unknown): void => {
      const result = BackgroundServiceStartedEvent.safeParse(message);
      if (!result.success) return;
      log.debug("Synchronising events from newly-started background service");
      this.synchronisingEventEmitter.syncLoggedEvents();
    };

    if (browser?.runtime?.onMessage) {
      browser.runtime.onMessage.addListener(onMessage);

      return () => browser.runtime.onMessage.removeListener(onMessage);
    } else {
      // When running on the devserver we don't have access to most extension
      // APIs, but this event is not essential.
      return () => {};
    }
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
          if (error.type === ErrorCode.REDDIT_TAB_NOT_CONNECTED) {
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
    this.emitter.emit("availabilityStatus", {
      type: "redditTabBecameAvailable",
      redditProvider: this.redditProvider,
    });
  }

  private markRedditUnavailable(): void {
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
          case "tagged":
            this.synchronisingEventEmitter.emitSoon(event);
            break;
          default:
            assertUnreachable(event);
        }
        return null;
      }),
    );

    return server;
  }

  readonly getRedditTabAvailability: () => Promise<RedditTabAvailability>;

  // TODO: maybe remove this and rely on useRedditTabAvailability query
  async requestAvailabilityStatus(): Promise<void> {
    const { available } = await this.getRedditTabAvailability();
    if (available) this.markRedditAvailable();
    else this.markRedditUnavailable();
  }

  getUiNotifications: () => Promise<Array<TaggedVaultonomyBackgroundEvent>>;

  getSettings: () => Promise<VaultonomySettings>;

  disconnect(): void {
    for (const stop of this.toStop) stop();
  }
}
