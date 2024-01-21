import { default as JsdomEnvironment } from "jest-environment-jsdom";
import { TextEncoder } from "util";

export default class CustomJsdomEnvironment extends JsdomEnvironment {
  async setup() {
    await super.setup();

    // Jest's jsdom environment does not provide TextEncoder but does provide
    // Uint8Array. If we provide node's TextEncoder impl, code that checks if
    // buffers are instanceof Uint8Array break, because the node TextEncoder
    // uses a different Uint8Array class than the jsdom one. So we also override
    // Uint8Array with the node impl.
    // https://github.com/jestjs/jest/issues/13227
    if (!this.global.TextEncoder) {
      this.global.TextEncoder = TextEncoder;
      this.global.TextDecoder = TextDecoder;
      this.global.Uint8Array = Uint8Array;
    } else {
      throw new Error(`JsdomEnvironment override is no longer needed`);
    }

    // jsdom doesn't implement crypto.subtle but node does.
    // Assigning doesn't work, but (re?)defining a property does.
    Object.defineProperty(this.global, "crypto", { value: crypto });
    Object.defineProperty(this.global, "CryptoKey", { value: CryptoKey });

    // We need structuredClone when testing storing CryptoKey in indexedDB
    Object.defineProperty(this.global, "structuredClone", {
      value: structuredClone,
    });
  }
}
