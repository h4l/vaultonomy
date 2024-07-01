import { JSONRPCClient, JSONRPCErrorException } from "json-rpc-2.0";
import { z } from "zod";

import { AnyManagedConnection } from "./connections";

export interface RPCMethodSpec<
  Params extends z.ZodTypeAny,
  Returns extends z.ZodTypeAny,
> {
  readonly name: string;
  readonly signature: z.ZodFunction<
    z.ZodTuple<[Params], z.ZodUnknown>,
    Returns
  >;
}

export function defineMethod<
  Params extends z.ZodTypeAny,
  Returns extends z.ZodTypeAny,
>(options: {
  name: string;
  params: Params;
  returns: Returns;
}): RPCMethodSpec<Params, z.ZodPromise<Returns>> {
  const { name, params, returns } = options;
  return {
    name,
    signature: z.function().args(params).returns(returns.promise()),
  };
}

export type RCPMethodCaller<
  Params extends z.ZodTypeAny,
  Returns extends z.ZodTypeAny,
> = (params: z.infer<Params>) => z.infer<Returns>;

export type RPCErrorMapper<E = Error> = (error: JSONRPCErrorException) => E;

export function createRCPMethodCaller<
  Params extends z.ZodTypeAny,
  Returns extends z.ZodTypeAny,
>(
  options: {
    method: RPCMethodSpec<Params, Returns>;
    mapError?: RPCErrorMapper;
  } & (
    | { managedClient: AnyManagedConnection<JSONRPCClient>; client?: undefined }
    | { client: JSONRPCClient; managedClient?: undefined }
  ),
): RCPMethodCaller<Params, Returns> {
  // implement() automatically validates params and the return value
  const method = options.method.signature.implement(async (params) => {
    try {
      const client =
        options.client ?? (await options.managedClient.getConnection());
      return await client.request(options.method.name, params);
    } catch (error) {
      if (!(options.mapError && error instanceof JSONRPCErrorException))
        throw error;
      throw options.mapError(error);
    }
  });

  return method as RCPMethodCaller<Params, Returns>;
}
