(async () => {
  try {
    const reddit = await import(chrome.runtime.getURL("reddit.js"));
    reddit.default();
  } catch (e) {
    console.error(e);
    throw e;
  }
})();
