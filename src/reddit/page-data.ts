import { z } from "zod";

import { HTTPResponseError } from "../errors/http";

// Every page seems to contain a script#data element containing the session data
// we need. But some pages are bigger than others. /coins doesn't have much
// going on, so it's smaller & faster (than say the homepage).
export const DEFAULT_PAGE_DATA_URL = "https://www.reddit.com/coins";

const PageData = z.object({
  user: z.object({
    account: z
      .object({
        id: z.string(),
        // has Reddit Premium (via award or subscription)
        isGold: z.boolean().default(false),
        accountIcon: z.string().url(),
        // username (not display name)
        displayText: z.string(),
      })
      .nullish(),
  }),
  session: z
    .object({
      accessToken: z.string().nullish(),
    })
    .nullish(),
});

export interface InPageRedditUser {
  userID: string;
  username: string;
  hasPremium: boolean;
  accountIconURL: string;
  authToken: string;
}

export async function fetchPageData(
  pageUrl: string = DEFAULT_PAGE_DATA_URL
): Promise<InPageRedditUser | undefined> {
  const response = await fetch(pageUrl);
  if (!response.ok) {
    throw new HTTPResponseError(`Request for data-containing page failed`, {
      response,
    });
  }
  const json = parsePageJSONData(await response.text());
  let pageData;
  try {
    pageData = PageData.parse(json);
  } catch (e) {
    throw new Error(`page #data JSON value is not structured as expected`, {
      cause: e,
    });
  }
  if (!pageData.user.account || !pageData.session?.accessToken) {
    // not logged in
    return undefined;
  }
  const account = pageData.user.account;
  return {
    userID: account.id,
    username: account.displayText,
    accountIconURL: account.accountIcon,
    hasPremium: account.isGold,
    authToken: pageData.session.accessToken,
  };
}

export function parsePageJSONData(html: string): object {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const dataScript = doc.querySelector("#data");
  if (!dataScript) throw new Error("page contains no #data element");
  const dataScriptContent = /^\s*window\.\w+\s*=\s*(.*?);?\s*$/m.exec(
    dataScript.innerHTML
  );
  if (!dataScriptContent)
    throw new Error("#data element's content is not structured as expected");
  try {
    return JSON.parse(dataScriptContent[1]);
  } catch (e) {
    throw new Error("#data element's content is not valid JSON", { cause: e });
  }
}
