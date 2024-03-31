import { redditTabUrlPatterns } from "../background/isReditTab";
import { Stop } from "../types";
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

export function watchGlobalRedditTabScriptingPermission(
  onChanged: (hasPermission: boolean) => void,
): Stop {
  let stopped = false;
  let hadPermission: boolean | undefined;
  const patterns = new Set(redditTabUrlPatterns());

  hasGlobalRedditTabScriptingPermission().then((hasPermission) => {
    if (hadPermission === undefined) hadPermission = hasPermission;
  });

  const onPermissionAddedOrRemoved = (
    permissions: chrome.permissions.Permissions,
  ) => {
    if (!permissions.origins?.some((origin) => patterns.has(origin))) return;
    // permissions.permissions is empty when adding/removing host permissions
    // Probably as there isn't an explicit permission name for host permissions.
    hasGlobalRedditTabScriptingPermission().then((hasPermission) => {
      if (hasPermission === hadPermission || stopped) return;
      hadPermission = hasPermission;
      onChanged(hasPermission);
    });
  };

  browser.permissions.onAdded.addListener(onPermissionAddedOrRemoved);
  browser.permissions.onRemoved.addListener(onPermissionAddedOrRemoved);

  return () => {
    stopped = true;

    browser.permissions.onAdded.removeListener(onPermissionAddedOrRemoved);
    browser.permissions.onRemoved.removeListener(onPermissionAddedOrRemoved);
  };
}
