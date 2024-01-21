import { BackgroundService } from "../background/BackgroundService";
import { log } from "../logging";
import { devModeRedditInteractionProxyPort } from "../messaging";
import { REDDIT_INTERACTION } from "../reddit/reddit-interaction-spec";
import { browser } from "../webextension";
import { bridgePorts } from "./bridgePorts";
import { isDevServerSender } from "./isDevServerSender";

export class DevModeBackgroundService extends BackgroundService {
  async handleExtensionConnection(port: chrome.runtime.Port): Promise<void> {
    if (port.name === devModeRedditInteractionProxyPort) {
      await this.forwardDevServerRedditInteractionConnection(port);
    }

    await super.handleExtensionConnection(port);
  }

  private async forwardDevServerRedditInteractionConnection(
    port: chrome.runtime.Port,
  ) {
    // We run a content script in dev-server tabs that connects to the
    // active Reddit tab to give the dev-mode UI a RedditProvider to talk to
    // Reddit with.
    //
    // content scripts can't access browser.tabs APIs, so the dev UI can't
    // directly connect to the Reddit tab like the production UI can. So the dev
    // server connects to the background service worker instead, and we open a
    // connection to the Reddit tab to forward messages on its behalf.
    const redditTabConnection = await this.redditTabConnection;
    const connectedRedditTab = redditTabConnection.connectedRedditTab;
    if (!connectedRedditTab) {
      log.debug(
        `received ${devModeRedditInteractionProxyPort} connection without a connected Reddit tab — disconnecting`,
      );
      port.disconnect();
      return;
    }
    const redditInteractionPort = browser.tabs.connect(connectedRedditTab.id!, {
      name: REDDIT_INTERACTION,
    });
    bridgePorts(port, redditInteractionPort);
    return;
  }

  handleExtensionMessage(
    _message: unknown,
    sender: chrome.runtime.MessageSender,
    _sendResponse: (response?: any) => void,
  ): true | undefined {
    if (import.meta.env.MODE === "development" && isDevServerSender(sender)) {
      // Dev server tabs don't receive messages by default, we have to explicitly
      // address messages to them.
      this.messageBroadcaster.registerTabRunningContentScript(sender.tab.id);
    }
    return super.handleExtensionMessage(_message, sender, _sendResponse);
  }
}
