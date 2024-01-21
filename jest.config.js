/** @type {import('jest').Config} */
export default {
  // Workaround for https://github.com/jestjs/jest/issues/14305 which is fixed in jest 30.
  prettierPath: new URL(await import.meta.resolve("prettier-2")).pathname,

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
            optimizer: {
              globals: {
                vars: {
                  "import.meta.env": "__import_meta_env",
                },
              },
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
