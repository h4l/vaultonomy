type TabWithId = Omit<chrome.tabs.Tab, "id"> &
  Required<Pick<chrome.tabs.Tab, "id">>;
type SenderWithTabId = Omit<chrome.runtime.MessageSender, "tab"> & {
  tab: TabWithId;
};

export function isDevServerSender(
  sender: chrome.runtime.MessageSender,
): sender is SenderWithTabId {
  if (!sender.url || sender?.tab?.id === undefined) return false;
  return new URL(sender.url).origin === "http://localhost:5173";
}
