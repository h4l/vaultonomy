export interface VaultonomyStatsConfig {
  api_secret: string;
  measurement_id: string;
  endpoint: string;
  client_id: string;
}

export interface VaultonomyDevConfig {
  extensionId: string;
  tanstackQueryDevToolsEnabled: boolean;
}

export type ReleaseTarget = "development" | "production";
export type BrowserTarget = "chrome" | "firefox";

export type VaultonomyConfig = {
  browserTarget: BrowserTarget;
  version: string;
};

export type VaultonomyConfigProd = VaultonomyConfig & {
  releaseTarget: "production";
  stats: Readonly<VaultonomyStatsConfig>;
  dev: null;
};
export type VaultonomyConfigDev = VaultonomyConfig & {
  releaseTarget: "development";
  stats: Readonly<VaultonomyStatsConfig> | null;
  dev: Readonly<VaultonomyDevConfig>;
};

export interface VaultonomyGlobal {
  VAULTONOMY: Readonly<VaultonomyConfigProd | VaultonomyConfigDev>;
}
