import { jest } from "@jest/globals";

// jest.config.js configures @swc/jest to map Vite's import.meta.env var to
// the global __import_meta_env, so these build-time constants can be used and
// defined in test code.

test("import.meta.env is rewritten to __import_meta_env", () => {
  expect(import.meta.env).toBe((global as any).__import_meta_env);
});

test('import.meta.env.MODE is "development"', () => {
  expect(import.meta.env.MODE).toBe("development");
});

describe("something is different in production mode", () => {
  let replaced: jest.Replaced<string>;
  beforeEach(() => {
    // Can also just directly assign, e.g. import.meta.env.MODE = 'production'
    replaced = jest.replaceProperty(import.meta.env, "MODE", "production");
  });
  afterEach(() => {
    replaced.restore();
  });
  test('import.meta.env.MODE can be changed to "production"', () => {
    expect(import.meta.env.MODE).toBe("production");
  });
});

test('import.meta.env.MODE is "development" again', () => {
  expect(import.meta.env.MODE).toBe("development");
});
