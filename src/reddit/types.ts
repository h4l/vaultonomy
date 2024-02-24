import { z } from "zod";

export const RedditUserProfile = z.object({
  userID: z.string(),
  username: z.string(),
  hasPremium: z.boolean(),
  accountIconURL: z.string().url(),
  accountIconFullBodyURL: z.string().url().nullable(),
});
export type RedditUserProfile = z.infer<typeof RedditUserProfile>;
