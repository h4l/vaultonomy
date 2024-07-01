import { jest } from "@jest/globals";
import { JSONRPCClient } from "json-rpc-2.0";
import { ZodError, z } from "zod";

import { ReconnectingManagedConnection } from "../connections";
import { createRCPMethodCaller, defineMethod } from "../typing";

test("defineMethod()", async () => {
  const method = defineMethod({
    name: "greet",
    params: z.object({ name: z.string(), msg: z.string() }),
    returns: z.string(),
  });

  expect(method.name).toEqual("greet");
  expect(method.signature).toBeInstanceOf(z.ZodFunction);
  await expect(
    method.signature.implement(async ({ name, msg }) => `${msg} ${name}`)({
      msg: "hi",
      name: "Bob",
    }),
  ).resolves.toEqual("hi Bob");
});

describe("createRCPMethodCaller()", () => {
  const method = defineMethod({
    name: "greet",
    params: z.object({ name: z.string(), msg: z.string() }),
    returns: z.string(),
  });
  const client = new JSONRPCClient(async () => undefined);
  const greet = createRCPMethodCaller({ method, client });

  test("creates client request when called", async () => {
    jest.spyOn(JSONRPCClient.prototype, "request").mockResolvedValue("hi Bob");
    await expect(greet({ name: "Bob", msg: "hi" })).resolves.toEqual("hi Bob");
    expect(JSONRPCClient.prototype.request).toHaveBeenCalledWith("greet", {
      name: "Bob",
      msg: "hi",
    });
  });

  test("creates request to managedClient when called", async () => {
    const managedClientGreet = createRCPMethodCaller({
      method,
      managedClient: new ReconnectingManagedConnection<JSONRPCClient>(() => [
        client,
        () => {},
      ]),
    });
    jest.spyOn(JSONRPCClient.prototype, "request").mockResolvedValue("hi Bob");
    await expect(
      managedClientGreet({ name: "Bob", msg: "hi" }),
    ).resolves.toEqual("hi Bob");
    expect(JSONRPCClient.prototype.request).toHaveBeenCalledWith("greet", {
      name: "Bob",
      msg: "hi",
    });
  });

  test("validates param with its zod type", async () => {
    const result = greet({ name: 42 as unknown as string, msg: "hi" });
    await expect(result).rejects.toThrow(ZodError);
    await expect(result).rejects.toThrow("Expected string, received number");
  });

  test("validates return value with signature's return zod type", async () => {
    jest.spyOn(JSONRPCClient.prototype, "request").mockResolvedValue(true);
    const result = greet({ name: "Bob", msg: "hi" });
    await expect(result).rejects.toThrow(ZodError);
    await expect(result).rejects.toThrow("Expected string, received boolean");
  });
});
