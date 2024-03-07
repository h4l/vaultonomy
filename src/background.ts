import { BackgroundService } from "./background/BackgroundService";
import { DevModeBackgroundService } from "./devserver/DevModeBackgroundService";
import { log } from "./logging";
import { browser } from "./webextension";

/*
Tab connection strategy
-----------------------

There are 4 main ways we could approach establishing communication with Reddit:

1. Include an iframe hosting a Reddit page in our UI
  - Reddit (quite sensibly) uses X-Frame-Options to prevent being loaded in
    iframes.
  - iframe would go away if our UI was closed — couldn't maintain background
    connections.
2. Request global host permissions for reddit.com
  - Simplest to implement, but the extension always has access to all reddit
    pages, which is not necessary
3. Use an optional host permission for reddit.com and request it when active.
   possibly auto-revoke it when not active, or after some delay.
  - More complex than 2, and potentially annoying for users to be prompted to
    grant access.
  - Grants access to all reddit tabs, not just a single tab
4. Use activeTab permission require that the user trigger the extension on a
   reddit tab.
  - Good for privacy, as the extension has no access until triggered, and
    closing the tab cuts off the access.
  - No need for permission requests, either at install or runtime
  - Potential for bad UX when opening the extension when a reddit tab is not
    active. Or when the extension is active, but the tab the user started on is
    closed.

The Headgear extension uses 4 in conjunction with a popup window. That works
well, as the popup can't stay open if the tab is changed. Here we're using
either separate full tabs/windows or the sidebar, which allows the lifetime of
the extension UI to outlive the reddit tab. Still, my feeling is that 4 is still
a good option. Using a sidebar by default should tie the extension to a tab from
a user POV.
*/

export function main() {
  log.info("vite env", import.meta.env);
  if (import.meta.env.MODE === "development") {
    new DevModeBackgroundService();
  } else {
    new BackgroundService();
  }
}
