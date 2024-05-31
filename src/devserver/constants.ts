function isValidExtensionId(value: unknown) {
  return typeof value === "string" && /\w+/.test(value);
}

if (!isValidExtensionId(import.meta.env.VITE_VAULTONOMY_DEV_EXTENSION_ID)) {
  throw new Error("VITE_VAULTONOMY_DEV_EXTENSION_ID is not set in a .env file");
}

export const VAULTONOMY_DEV_EXTENSION_ID: string = import.meta.env
  .VITE_VAULTONOMY_DEV_EXTENSION_ID;
