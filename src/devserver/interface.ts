// This module provides a way to access the Vaultonomy RedditProvider from
// outside the extension, specifically so that we can run the UI in a regular
// HTTP dev server (e.g. with hot reloading). It's not used in the production
// build.
//
// We use the same principle as https://eips.ethereum.org/EIPS/eip-6963 to
// announce and request our RedditProvider.
import { RedditProvider } from "../reddit/reddit-interaction-client";

export interface VaultonomyProviderInfo {
  uuid: string;
  name: string;
  rdns: string;
}

export interface VaultonomyProviderDetail {
  info: VaultonomyProviderInfo;
  provider: RedditProvider;
}

export const announceProviderEventType = "vaultonomy:announceProvider";
export const requestProviderEventType = "vaultonomy:requestProvider";

// Announce Event dispatched by a Vaultonomy Extension
export interface VaultonomyAnnounceProviderEvent extends CustomEvent {
  type: typeof announceProviderEventType;
  detail: VaultonomyProviderDetail;
}

export function isVaultonomyAnnounceProviderEvent(
  event: unknown,
): event is VaultonomyAnnounceProviderEvent {
  const _e = event as Partial<VaultonomyAnnounceProviderEvent>;
  return (
    _e.type === announceProviderEventType &&
    typeof _e.detail?.info === "string" &&
    typeof _e.detail.provider.emitter === "object"
  );
}

// Request Event dispatched by dev-mode Vaultonomy UI from HTTP dev server
export interface VaultonomyRequestProviderEvent extends Event {
  type: typeof requestProviderEventType;
}
