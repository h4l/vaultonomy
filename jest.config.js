/** @type {import('ts-jest/dist/types').JestConfigWithTsJest} */
export default {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  testEnvironmentOptions: {
    // jsdom test environment uses "browser" by default. This causes jest to
    // import the "browser" export from package.json. Preact (and probably other
    // modules) link to ESM modules from the "browser" export, and this fails
    // because jest doesn't support ESM modules by default (and doesn't
    // transpile stuff in node_modules by default).
    // See: https://jestjs.io/docs/configuration#testenvironmentoptions-object
    // FIXME: I think we can leave this as the default as we're using jest with
    // ES module support enabled.
    // customExportConditions: ["node", "node-addons"],
  },
  // transform: {
  //   "\\.tsx?$": [
  //     "ts-jest",
  //     {
  //       tsconfig: "./tsconfig.jest.json",
  //     },
  //   ],
  // },

  // maxWorkers: 1,
  // testPathIgnorePatterns: ["/node_modules/", ".mock."],
  // setupFilesAfterEnv: ["<rootDir>/jest-setup.ts"],
  // transform: {
  //   "\\.svg$": "<rootDir>/jest-webpack-asset-source-transformer",
  // },
};
