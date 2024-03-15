import { z } from "zod";

export const SuspendedRedditUserProfile = z.object({
  username: z.string(),
  isSuspended: z.literal(true),
});
export type SuspendedRedditUserProfile = z.infer<
  typeof SuspendedRedditUserProfile
>;

export const RedditUserProfile = z.object({
  userID: z.string(),
  username: z.string(),
  hasPremium: z.boolean(),
  accountIconURL: z.string().url(),
  accountIconFullBodyURL: z.string().url().nullable(),
  isSuspended: z.literal(false),
});
export type RedditUserProfile = z.infer<typeof RedditUserProfile>;

export const AnyRedditUserProfile = z.discriminatedUnion("isSuspended", [
  SuspendedRedditUserProfile,
  RedditUserProfile,
]);
export type AnyRedditUserProfile = z.infer<typeof AnyRedditUserProfile>;

export const redditUsername = z.string().regex(/^[\w-]{1,20}$/);
