(async () => {
  try {
    (
      await import(chrome.runtime.getURL("reddit-detect-user-interest.js"))
    ).default();
  } catch (e) {
    console.error(e);
    throw e;
  }
})();
