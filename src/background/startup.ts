class SynchronousStartup {
  #startupFinished = false;
  markStartupFinished() {
    this.#startupFinished = true;
  }
  get startupFinished(): boolean {
    return this.#startupFinished;
  }
}

/**
 * Check whether synchronous extension startup has finished. Some events, like
 * browser.action.onClicked must happen synchronously at startup, otherwise
 * they don't receive events that caused the extension to start.
 */
export const startup = new SynchronousStartup();
