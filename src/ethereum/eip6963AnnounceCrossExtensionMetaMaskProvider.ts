import {
  createExternalExtensionProvider,
  eip6963AnnounceProvider,
} from "@metamask/providers";

import { getMetaMaskExtensionId } from "../webextensions/extension-ids";

export const CROSS_EXTENSION_METAMASK_ID = "eth.vaultonomy.metamask";

export type Result =
  | { result: "metamask-not-installed" }
  | { result: "announced" };

export async function eip6963AnnounceCrossExtensionMetaMaskProvider(): Promise<Result> {
  const metaMaskExtensionId = await getMetaMaskExtensionId();
  if (!metaMaskExtensionId) {
    return { result: "metamask-not-installed" };
  }

  const provider = createExternalExtensionProvider(metaMaskExtensionId);
  eip6963AnnounceProvider({
    provider,
    info: {
      name: "MetaMask from Vaultonomy",
      uuid: crypto.randomUUID(),
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
      rdns: CROSS_EXTENSION_METAMASK_ID,
    },
  });
  return { result: "announced" };
}
