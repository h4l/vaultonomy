export function isRedditTab(tab: chrome.tabs.Tab): boolean {
  // TODO: maybe allow aliases like new.reddit.com?
  return tab.url?.startsWith("https://www.reddit.com/") || false;
}
