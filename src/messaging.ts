import { z } from "zod";

import { redditUsername } from "./reddit/types";

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

export const BackgroundServiceStartedEvent = z.object({
  type: z.literal("backgroundServiceStarted"),
  startTime: z.number().positive(),
});
export type BackgroundServiceStartedEvent = z.infer<
  typeof BackgroundServiceStartedEvent
>;
