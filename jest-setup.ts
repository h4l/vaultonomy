import { jest } from "@jest/globals";

globalThis.fetch = jest.fn<typeof globalThis.fetch>();
