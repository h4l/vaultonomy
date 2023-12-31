import { isExtensionInstalled } from "./is-extension-installed";

export interface ExtensionDetector {
  isExtensionInstalled(extensionId: string): Promise<boolean>;
}

export class DefaultExtensionDetector implements ExtensionDetector {
  cache: Record<string, Promise<boolean>> = {};

  async isExtensionInstalled(extensionId: string): Promise<boolean> {
    if (this.cache[extensionId] === undefined) {
      this.cache[extensionId] = isExtensionInstalled(extensionId);
    }
    return this.cache[extensionId];
  }

  resetCache(): void {
    this.cache = {};
  }
}
