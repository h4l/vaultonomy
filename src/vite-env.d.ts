/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MODE: "development" | "production";
  readonly VITE_TANSTACK_QUERY_DEV_TOOLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
