import { JSONRPCClient } from "json-rpc-2.0";
import { z } from "zod";

export interface RPCMethodSpec<
  Params extends z.ZodTypeAny,
  Returns extends z.ZodTypeAny
> {
  readonly name: string;
  readonly signature: z.ZodFunction<
    z.ZodTuple<[Params], z.ZodUnknown>,
    Returns
  >;
}

export function defineMethod<
  Params extends z.ZodTypeAny,
  Returns extends z.ZodTypeAny
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

export function createRCPMethodCaller<
  Params extends z.ZodTypeAny,
  Returns extends z.ZodTypeAny
>(options: {
  method: RPCMethodSpec<Params, Returns>;
  client: JSONRPCClient;
}): (params: z.infer<Params>) => z.infer<Returns> {
  // implement() automatically validates params and the return value
  return options.method.signature.implement(async (params) => {
    return await options.client.request(options.method.name, params);
  });
}
