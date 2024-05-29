import { z } from "zod";

import { VaultonomyError } from "../VaultonomyError";
import { assert } from "../assert";
import { HTTPResponseError } from "../errors/http";
import { log } from "../logging";

export class APIError extends VaultonomyError {}

export type GqlFedQuery<
  VariablesT extends Record<string, string> = Record<string, string>,
> = {
  extensions: {
    persistedQuery: {
      sha256Hash: string;
      version: number;
    };
  };
  operationName: string;
  variables: VariablesT;
};

const GqlErrorResponse = z
  .object({
    errors: z
      .array(
        z.object({
          message: z.string(),
          path: z.array(z.string()),
        }),
      )
      .min(1),
  })
  .transform(({ errors }) => ({ errors, data: undefined }));

function createGqlResponseSchema<DataSchemaT extends z.AnyZodObject>(
  dataSchema: DataSchemaT,
) {
  return z
    .object({
      data: dataSchema,
    })
    .transform(({ data }) => ({ errors: undefined, data }));
}

function createResponseBodySchema<ResponseDataSchemaT extends z.AnyZodObject>(
  responseDataSchema: ResponseDataSchemaT,
) {
  return GqlErrorResponse.or(createGqlResponseSchema(responseDataSchema));
}

type GqlFedOperationOptions<
  VariablesSchemaT extends z.AnyZodObject,
  ResponseDataSchemaT extends z.AnyZodObject,
> = {
  operationName: string;
  persistedQuerySha256: string;
  variablesSchema: VariablesSchemaT;
  responseDataSchema: ResponseDataSchemaT;
  description: string;
};

/** Create a function that makes API requests to the gql-fed API endpoint. */
export class GqlFedOperation<
  VariablesSchemaT extends z.AnyZodObject,
  ResponseDataSchemaT extends z.AnyZodObject,
> {
  private readonly responseBodySchema: ReturnType<
    typeof createResponseBodySchema<ResponseDataSchemaT>
  >;
  constructor(
    readonly operationName: string,
    readonly persistedQuerySha256: string,
    readonly variablesSchema: VariablesSchemaT,
    readonly responseDataSchema: ResponseDataSchemaT,
    readonly description: string,
  ) {
    this.responseBodySchema = createResponseBodySchema(this.responseDataSchema);
  }

  static create<
    VariablesSchemaT extends z.AnyZodObject,
    ResponseDataSchemaT extends z.AnyZodObject,
  >(options: GqlFedOperationOptions<VariablesSchemaT, ResponseDataSchemaT>) {
    return new GqlFedOperation(
      options.operationName,
      options.persistedQuerySha256,
      options.variablesSchema,
      options.responseDataSchema,
      options.description,
    );
  }

  private getQuery(
    vars: z.input<VariablesSchemaT>,
  ): GqlFedQuery<z.infer<VariablesSchemaT>> {
    const variablesResult = this.variablesSchema.safeParse(vars);
    if (!variablesResult.success) {
      throw new Error(
        `Provided vars are invalid for query ${this.operationName}: ${variablesResult.error}`,
      );
    }

    return {
      extensions: {
        persistedQuery: {
          sha256Hash: this.persistedQuerySha256,
          version: 1,
        },
      },
      operationName: this.operationName,
      variables: variablesResult.data,
    };
  }

  async makeRequest(options: {
    authToken: string;
    vars: z.input<VariablesSchemaT>;
  }): Promise<z.infer<ResponseDataSchemaT>> {
    const query = this.getQuery(options.vars);

    const response = await fetch("https://gql-fed.reddit.com/", {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${options.authToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(query),
    });
    if (!response.ok) {
      throw new HTTPResponseError(
        `HTTP request to ${this.description} failed`,
        {
          response,
        },
      );
    }

    const responseJson = await response.json();
    const result = this.responseBodySchema.safeParse(responseJson);

    if (!result.success) {
      const msg = `Response to ${this.description} request is not structured as expected`;
      log.error(`${msg}:`, result.error, ", response JSON:", responseJson);
      throw new HTTPResponseError(msg, { response });
    }

    const body = result.data;
    if (body.errors) {
      const messages = body.errors.map(
        (e) => `${e.path.join(".")}: ${e.message}`,
      );
      const msg = `API request to ${this.description} did not execute successfully`;
      log.error(`${msg}: ${messages}`, `query:`, query);
      throw new APIError(msg);
    }
    assert(body.data);
    return body.data;
  }
}
