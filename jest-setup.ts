import { expect, jest } from "@jest/globals";
import { JSONRPCErrorException } from "json-rpc-2.0";

globalThis.fetch = jest.fn<typeof globalThis.fetch>();

type VaultonomyGlobal = {
  __import_meta_env?: Partial<ImportMetaEnv>;
  VAULTONOMY?: typeof VAULTONOMY;
};

(global as VaultonomyGlobal).__import_meta_env = {
  MODE: "development",
};

(global as VaultonomyGlobal).VAULTONOMY = {
  version: "0.0.0",
  releaseTarget: "production",
  browserTarget: "chrome",
  stats: {
    api_secret: "API_SECRET",
    client_id: "CLIENT_ID",
    endpoint: "https://example.com/mp/collect",
    measurement_id: "MEASUREMENT_ID",
  },
  dev: null,
};

expect.addEqualityTesters([
  // consider error code and data when comparing JSON RCP errors
  function jsonRPCErrorExceptionsAreEqual(e1, e2) {
    if (
      e1 instanceof JSONRPCErrorException &&
      e2 instanceof JSONRPCErrorException
    ) {
      return (
        e1.message === e2.message &&
        e1.code === e2.code &&
        this.equals(e1.data, e2.data)
      );
    }
  },
]);
