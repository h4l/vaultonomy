import { z } from "zod";

import { redditUsername } from "./reddit/types";

// TODO create a way for the dev-server to register itself to receive messages
// from the background service worker.

export const UserLinkInteractionEvent = z.object({
  type: z.literal("userLinkInteraction"),
  interest: z.enum(["interested", "disinterested"]),
  username: redditUsername,
  startTime: z.number(),
  dwellTime: z.number(),
});
export type UserLinkInteractionEvent = z.infer<typeof UserLinkInteractionEvent>;

export const UserPageInteractionEvent = z.object({
  type: z.literal("userPageInteraction"),
  username: redditUsername,
  startTime: z.number(),
});
export type UserPageInteractionEvent = z.infer<typeof UserPageInteractionEvent>;

export const InterestInUserEvent = z.discriminatedUnion("type", [
  UserLinkInteractionEvent,
  UserPageInteractionEvent,
]);
export type InterestInUserEvent = z.infer<typeof InterestInUserEvent>;

/**
 * Sent by the UI running in our dev-server to subscribe to messages from the
 * background service.
 */
// TODO: DevServerUINeedsMessagesEvent is not needed now, we auto-register devserver tabs to receive broadcast messages
// export const DevServerUINeedsMessagesEvent = z.object({
//   type: z.literal("devServerUINeedsMessages"),
// });
// export type DevServerUINeedsMessagesEvent = z.infer<
//   typeof DevServerUINeedsMessagesEvent
// >;

/**
 * Sent as a broadcast message from background worker when the Reddit tab
 * running our contentscript connects.
 */
// export interface RedditTabBecameAvailableEvent {
//   type: "redditTabBecameAvailable";
//   tabId: number;
// }

// FIXME: These are background-specific, move them to to ./background/ (we don't
//  include tabId in the UI).
export const RedditTabBecameAvailableEvent = z.object({
  type: z.literal("redditTabBecameAvailable"),
  tabId: z.number(),
});
export type RedditTabBecameAvailableEvent = z.infer<
  typeof RedditTabBecameAvailableEvent
>;

export interface RedditTabConnectionEvents {
  availabilityStatus: (
    event: RedditTabBecameAvailableEvent | RedditTabBecameUnavailableEvent,
  ) => void;
}

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

// TODO: remove this, I don't think we use it anymore
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
