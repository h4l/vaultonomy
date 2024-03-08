import { VaultonomyError } from "../../VaultonomyError";

export type Unbind = () => void;

export class TabNotAvailable extends VaultonomyError {}

export interface TabProvider {
  getTab(): Promise<chrome.tabs.Tab>;
  unbind(): void;
}
