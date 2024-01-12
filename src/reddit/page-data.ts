import { z } from "zod";

import { HTTPResponseError } from "../errors/http";

// Every page seems to contain a script#data element containing the session data
// we need. But some pages are bigger than others. /premium doesn't have much
// going on, so it's smaller & faster (than say the homepage).
export const DEFAULT_PAGE_DATA_URL = "https://www.reddit.com/premium";

const RawPageData = z.object({
  user: z.object({
    account: z
      .object({
        id: z.string(),
        // has Reddit Premium (via award or subscription)
        isGold: z.boolean().default(false),
        accountIcon: z.string().url(),
        snoovatarFullBodyAsset: z.string().url(),
        // username (not display name)
        displayText: z.string(),
      })
      .nullish(),
    session: z
      .object({
        accessToken: z.string().nullish(),
        expires: z.coerce.date().nullish(),
      })
      .nullish(),
  }),
});

export type PageData = AnonPageData | UserPageData;
export interface AnonPageData {
  loggedIn: false;
}
export interface UserPageData {
  loggedIn: true;
  user: RedditUser;
  auth: RedditUserAPICredentials;
}
export interface RedditUserAPICredentials {
  token: string;
  expires: Date;
}

export interface RedditUser {
  userID: string;
  username: string;
  hasPremium: boolean;
  accountIconURL: string;
  accountIconFullBodyURL: string;
}

export async function fetchPageData(
  pageUrl: string = DEFAULT_PAGE_DATA_URL,
): Promise<PageData> {
  const response = await fetch(pageUrl);
  if (!response.ok) {
    throw new HTTPResponseError(`Request for data-containing page failed`, {
      response,
    });
  }
  const json = parsePageJSONData(await response.text());
  const raw = RawPageData.safeParse(json);
  if (!raw.success) {
    throw new Error(`page #data JSON value is not structured as expected`, {
      cause: raw.error,
    });
  }

  // not logged in
  if (
    !raw.data.user.account ||
    !(raw.data.user.session?.accessToken && raw.data.user.session?.expires)
  )
    return { loggedIn: false };

  return {
    loggedIn: true,
    user: {
      userID: raw.data.user.account.id,
      username: raw.data.user.account.displayText,
      accountIconURL: raw.data.user.account.accountIcon,
      accountIconFullBodyURL: raw.data.user.account.snoovatarFullBodyAsset,
      hasPremium: raw.data.user.account.isGold,
    },
    auth: {
      token: raw.data.user.session.accessToken,
      expires: raw.data.user.session.expires,
    },
  };
}

export function parsePageJSONData(html: string): object {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const dataScript = doc.querySelector("#data");
  if (!dataScript) throw new Error("page contains no #data element");
  const dataScriptContent = /^\s*window\.\w+\s*=\s*(.*?);?\s*$/m.exec(
    dataScript.innerHTML,
  );
  if (!dataScriptContent)
    throw new Error("#data element's content is not structured as expected");
  try {
    return JSON.parse(dataScriptContent[1]);
  } catch (e) {
    throw new Error("#data element's content is not valid JSON", { cause: e });
  }
}
