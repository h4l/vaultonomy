import { assert } from "../../assert";
import mainCss from "../../css/main.css?inline";
import overlayHtml from "../../html/overlay.html?raw";
import vaultonomyLogoSvg from "../../img/vaultonomy-logo.svg?raw";

function replaceOverlayHtmlPlaceholders() {
  return overlayHtml.replaceAll("{{logo}}", vaultonomyLogoSvg);
}

export class ConnectionOverlay {
  overlayEl: HTMLElement | undefined;
  htmlElObserver: MutationObserver;
  warnOnUnload: (e: BeforeUnloadEvent) => void;
  onRemoved: ((connectionOverlay: ConnectionOverlay) => void) | undefined;

  constructor(
    options: {
      onRemoved?: (connectionOverlay: ConnectionOverlay) => void;
    } = {},
  ) {
    this.htmlElObserver = new MutationObserver(() =>
      setTimeout(() => this.applyHtmlElementStyle),
    );
    this.warnOnUnload = (e) => e.preventDefault();
    this.onRemoved = options.onRemoved;
  }

  applyHtmlElementStyle() {
    console.log("applyHtmlElementStyle()");
    const html = document.body.parentElement;
    assert(html);
    html.style.overflowY = "hidden";
  }

  render() {
    if (this.overlayEl) return;

    const html = document.body.parentElement;
    assert(html);
    this.htmlElObserver.observe(html, { attributeFilter: ["style"] });
    this.applyHtmlElementStyle();

    const overlayEl = (this.overlayEl = document.createElement("div"));
    overlayEl.id = "vaultonomy-connection-overlay";
    const overlayRoot = overlayEl.attachShadow({ mode: "open" });
    overlayRoot.innerHTML = replaceOverlayHtmlPlaceholders();
    const overlayStyle = overlayRoot.querySelector("style");
    assert(overlayStyle);
    overlayStyle.innerHTML = mainCss;

    overlayRoot
      .querySelector("button")
      ?.addEventListener("click", () => this.remove());

    document.body.appendChild(overlayEl);
    window.addEventListener("beforeunload", this.warnOnUnload);
  }

  remove() {
    this.htmlElObserver.disconnect();
    const html = document.body.parentElement;
    assert(html);
    html.style.overflowY = "";

    this.overlayEl?.remove();
    window.removeEventListener("beforeunload", this.warnOnUnload);
    this.onRemoved && this.onRemoved(this);
  }
}
