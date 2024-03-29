import { z } from "zod";

export const FetchFnOptions = z.object({
  method: z.enum(["GET", "POST"]),
  headers: z.record(z.string(), z.string()),
  body: z.string().optional(),
});

export const FetchFn = z
  .function()
  .args(z.string().url(), FetchFnOptions)
  .returns(z.promise<z.ZodType<Response>>(z.any()));
export type FetchFn = z.infer<typeof FetchFn>;

export const FetchCrossOriginMessage = z.object({
  type: z.literal("fetchCrossOrigin"),
  url: z.string().url(),
  options: FetchFnOptions,
});
export type FetchCrossOriginMessage = z.infer<typeof FetchCrossOriginMessage>;

export const FetchCrossOriginMessageResponse = z
  .object({
    success: z.literal(false),
    error: z.string(),
  })
  .or(
    z.object({
      success: z.literal(true),
      data: z.object({
        status: z.number().positive(),
        statusText: z.string(),
        headers: z
          .record(z.string(), z.string())
          .or(z.tuple([z.string(), z.string()]).array())
          .optional(),
        body: z.string(),
      }),
    }),
  );
export type FetchCrossOriginMessageResponse = z.infer<
  typeof FetchCrossOriginMessageResponse
>;
