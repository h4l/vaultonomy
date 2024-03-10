export function isRedditTab(
  tab: chrome.tabs.Tab,
): tab is chrome.tabs.Tab & { id: number } {
  return (
    (tab.id !== undefined &&
      (tab.url?.startsWith("https://www.reddit.com/") ||
        tab.url?.startsWith("https://new.reddit.com/"))) ??
    false
  );
}

export function redditTabUrlPatterns(): string[] {
  return ["https://www.reddit.com/*", "https://new.reddit.com/*"];
}
