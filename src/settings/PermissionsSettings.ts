import { redditTabUrlPatterns } from "../background/isReditTab";
import { browser } from "../webextension";

export async function hasGlobalRedditTabScriptingPermission(): Promise<boolean> {
  const redditOriginsPermittingScripting = await Promise.all(
    redditTabUrlPatterns().map((origin) =>
      browser.permissions.contains({
        origins: [origin],
        permissions: ["scripting"],
      }),
    ),
  );

  return redditOriginsPermittingScripting.some((x) => x);
}
