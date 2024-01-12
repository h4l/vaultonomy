import { number, z } from "zod";

/**
 * Sent as a broadcast message from background worker when the Reddit tab
 * running our contentscript connects.
 */
// export interface RedditTabBecameAvailableEvent {
//   type: "redditTabBecameAvailable";
//   tabId: number;
// }
export const RedditTabBecameAvailableEvent = z.object({
  type: z.literal("redditTabBecameAvailable"),
  tabId: z.number(),
});
export type RedditTabBecameAvailableEvent = z.infer<
  typeof RedditTabBecameAvailableEvent
>;

/**
 * Sent as a broadcast message from background worker when the Reddit tab
 * running our contentscript disconnects.
 */
// export interface RedditTabBecameUnavailableEvent {
//   type: "redditTabBecameUnavailable";
//   tabId: number;
// }
export const RedditTabBecameUnavailableEvent = z.object({
  type: z.literal("redditTabBecameUnavailable"),
  tabId: z.number(),
});
export type RedditTabBecameUnavailableEvent = z.infer<
  typeof RedditTabBecameUnavailableEvent
>;

// export interface UINeedsRedditTabEvent {
//   type: "uiNeedsRedditTab";
// }

export const UINeedsRedditTabEvent = z.object({
  type: z.literal("uiNeedsRedditTab"),
});
export type UINeedsRedditTabEvent = z.infer<typeof UINeedsRedditTabEvent>;

// TODO: Review if we need ErrorResponse
export const ErrorResponse = z.object({
  success: z.literal(false),
  error: z.string(),
});
export const UINeedsRedditTabSuccessResponse = z.object({
  success: z.literal(true),
  tabId: z.nullable(z.number()),
});
const UINeedsRedditTabResponse = z.discriminatedUnion("success", [
  ErrorResponse,
  UINeedsRedditTabSuccessResponse,
]);
export type UINeedsRedditTabResponse = z.infer<typeof UINeedsRedditTabResponse>;

// TODO: just use UINeedsRedditTabEvent for background
export const Message = z.discriminatedUnion("type", [
  RedditTabBecameAvailableEvent,
  RedditTabBecameUnavailableEvent,
  UINeedsRedditTabEvent,
]);

export const availabilityPortName = "availability";
