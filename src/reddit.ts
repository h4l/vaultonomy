import { createServerSession } from "./reddit/reddit-interaction-server";
import { REDDIT_INTERACTION } from "./reddit/reddit-interaction-spec";
import { bindPortToJSONRPCServer } from "./rpc/webextension-port-json-rpc";
import { browser } from "./webextension";

export async function createAvailabilityConnection() {
  const port = browser.runtime.connect({ name: "availability" });
  port.onDisconnect.addListener(() => {
    console.log("availability Port disconnected");
  });
}

export function handleRedditInteractionConnections() {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== REDDIT_INTERACTION) return;

    const server = createServerSession();
    bindPortToJSONRPCServer({ port, server });
  });
}

export function main() {
  const context = globalThis as { __mainRunCount?: number };
  context.__mainRunCount = (context.__mainRunCount ?? -1) + 1;
  console.log("main run count: ", context.__mainRunCount);

  createAvailabilityConnection();
  handleRedditInteractionConnections();
}
