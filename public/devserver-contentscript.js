(async () => {
  try {
    const devserver = await import(chrome.runtime.getURL("devserver.js"));
    devserver.default();
  } catch (e) {
    console.error(e);
    throw e;
  }
})();
