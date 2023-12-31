import { Buffer } from "buffer";
import process from "process";

export function applyPolyfills() {
  // Coinbase Wallet SDK expects the nodejs Buffer global to be available
  if (!window.Buffer) window.Buffer = Buffer;
  if (!window.process) window.process = process;
}
