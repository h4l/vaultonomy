import { expect, jest } from "@jest/globals";
import { JSONRPCErrorException } from "json-rpc-2.0";

globalThis.fetch = jest.fn<typeof globalThis.fetch>();

(global as any).__import_meta_env = {
  MODE: "development",
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
