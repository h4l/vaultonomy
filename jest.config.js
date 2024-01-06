/** @type {import('jest').Config} */
export default {
  testEnvironment: "<rootDir>/jest-environment-jsdom.ts",
  testPathIgnorePatterns: [".(fixtures|mock|utils).tsx?$"],
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          transform: {
            react: {
              runtime: "automatic",
            },
          },
        },
      },
    ],
  },
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  setupFilesAfterEnv: ["<rootDir>/jest-setup.ts"],
  resetMocks: true,
  resetModules: true,
};
