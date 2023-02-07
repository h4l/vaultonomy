import browser from "webextension-polyfill";

console.log("reddit-entry.ts");
// window.open(
//   "chrome-extension://hdeofaehcpeliiaooagbaokoklljghoc/html/popup.html"
// );
// browser.windows.create({
//   url: "/html/popup.html",
// });
// Enable navigation prompt
window.onbeforeunload = function () {
  console.log("onbeforeunload");
  return true;
};

setInterval(() => {
  console.log("heartbeat");
  browser.runtime.sendMessage({
    msg: "heartbeat",
    page: globalThis.location.href,
  });
}, 1000);

export {};
