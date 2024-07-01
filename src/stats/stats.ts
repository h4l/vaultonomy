import {
  ActivityToolId,
  CollectablesToolId,
} from "../settings/address-activity-tools";
import { AccountType } from "../ui/EthAccount";
import {
  SentPairingMessage,
  SignedPairingMessage,
} from "../ui/state/createVaultonomyStore";
import { WalletConnectorType } from "../wagmi";
import { GA4Event, GA4MPClient } from "./ga4mp";

type EmptyParams = Record<string, never>;

export type PageViewEvent = GA4Event<
  "page_view",
  {
    page_location: string;
    page_referrer?: string;
    page_title?: string;
    engagement_time_msec?: number;
  }
>;

export type VaultonomySearchPerformedEvent = GA4Event<
  "VT_search_triggered",
  {
    trigger: "manual" | "user-link-interaction" | "user-page-interaction";
    query_type: "username" | "address" | "ens-name";
  }
>;

export type VaultonomyWalletConnectedEvent = GA4Event<
  "VT_wallet_connected",
  { wallet_connector: WalletConnectorType }
>;

export type VaultonomyEthAddressCopiedEvent = GA4Event<
  "VT_ethAddress_copied",
  { account_type: AccountType }
>;

export type VaultonomyEthAddressToolUsedEvent = GA4Event<
  "VT_ethAddress_toolUsed",
  {
    tool_name: ActivityToolId | CollectablesToolId;
    account_type: AccountType;
  }
>;

export type VaultonomyPairingMsgFetchCompletedEvent = GA4Event<
  "VT_pairingMsgFetch_completed",
  { start_blocked_count: number }
>;

export type VaultonomyPairingMsgFetchFailedEvent = GA4Event<
  "VT_pairingMsgFetch_failed",
  EmptyParams
>;

export type VaultonomyPairingMsgSignCompletedEvent = GA4Event<
  "VT_pairingMsgSign_completed",
  EmptyParams
>;

export type VaultonomyPairingMsgSignFailedEvent = GA4Event<
  "VT_pairingMsgSign_failed",
  { reason: NonNullable<SignedPairingMessage["error"]> }
>;

export type VaultonomyPairingMsgSubmitCompletedEvent = GA4Event<
  "VT_pairingMsgSubmit_completed",
  EmptyParams
>;

export type VaultonomyPairingMsgSubmitFailedEvent = GA4Event<
  "VT_pairingMsgSubmit_failed",
  { reason: NonNullable<SentPairingMessage["error"]> }
>;

export type VaultonomyHelpEnabledEvent = GA4Event<
  "VT_help_enabled",
  EmptyParams
>;

export type VaultonomyHelpDisabledEvent = GA4Event<
  "VT_help_disabled",
  EmptyParams
>;

export type VaultonomyHelpToggledEvent = GA4Event<
  "VT_helpItem_selected",
  { help_id: string }
>;

type VaultonomyStatsEvent =
  | VaultonomySearchPerformedEvent
  | VaultonomyWalletConnectedEvent
  | VaultonomyEthAddressCopiedEvent
  | VaultonomyEthAddressToolUsedEvent
  | VaultonomyHelpEnabledEvent
  | VaultonomyHelpDisabledEvent
  | VaultonomyHelpToggledEvent;

export type VaultonomyGA4MPClient = GA4MPClient<
  PageViewEvent | VaultonomyStatsEvent | GA4Event
>;

export function createClient(): VaultonomyGA4MPClient | undefined {
  const stats = VAULTONOMY.stats;
  if (!stats) return undefined;

  return GA4MPClient.create({
    apiSecret: stats.api_secret,
    measurementId: stats.measurement_id,
    endpoint: stats.endpoint,
    clientId: stats.client_id,
    userProperties: {
      build_version: VAULTONOMY.version,
      build_target: `${VAULTONOMY.releaseTarget}-${VAULTONOMY.browserTarget}`,
    },
  });
}
