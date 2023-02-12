/** @type {import('jest').Config} */
export default {
  testEnvironment: "jsdom",
  testPathIgnorePatterns: [".(fixtures|mock|utils).tsx?$"],
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  setupFilesAfterEnv: ["<rootDir>/jest-setup.ts"],
  resetMocks: true,
  resetModules: true,
};
