export function isRedditTab(
  tab: chrome.tabs.Tab,
): tab is chrome.tabs.Tab & { id: number } {
  return !!(
    tab.id !== undefined &&
    tab.url?.match(/^https:\/\/(?:www|new|old)\.reddit\.com\//)
  );
}

export function redditTabUrlPatterns(): string[] {
  return [
    "https://www.reddit.com/*",
    "https://new.reddit.com/*",
    "https://old.reddit.com/*",
  ];
}
