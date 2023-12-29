import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import {
  nodeResolve,
  DEFAULTS as nodeResolveDefaults,
} from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import swc from "@rollup/plugin-swc";
import { FilterPattern, createFilter } from "@rollup/pluginutils";
import autoprefixer from "autoprefixer";
import { readFile } from "fs/promises";
import atImport from "postcss-import";
import { defineConfig } from "rollup";
import type { Plugin, TransformPluginContext, TransformResult } from "rollup";
import copy from "rollup-plugin-copy";
import nodePolyfills from "rollup-plugin-polyfill-node";
import postcss from "rollup-plugin-postcss";
import tailwindcss from "tailwindcss";
import { fileURLToPath } from "url";

const IGNORED_WARNINGS: ReadonlyArray<string> = [
  'Module level directives cause errors when bundled, "use client" in "',
];

const swcrc = JSON.parse(await readFile("./.swcrc", { encoding: "utf-8" }));

function importFileAsString(
  options: { include?: FilterPattern; exclude?: FilterPattern } = {}
): Plugin {
  const filter = createFilter(options.include, options.exclude);

  return {
    name: "file-as-string",

    transform(
      this: TransformPluginContext,
      code: string,
      id: string
    ): TransformResult {
      if (filter(id)) {
        return `export default ${JSON.stringify(code)};`;
      }
    },
  };
}

function parseBuildMode(): "development" | "production" {
  const env = process.env.BUILD || "development";
  if (!(env === "development" || env === "production")) {
    throw new Error(
      `invalid BUILD envar: ${JSON.stringify(
        env
      )}: value must be "development" or "production"`
    );
  }
  return env;
}

export default defineConfig({
  input: {
    background: fileURLToPath(
      new URL("./src/background-entry.ts", import.meta.url)
    ),
    reddit: fileURLToPath(new URL("./src/reddit.ts", import.meta.url)),
    ui: fileURLToPath(new URL("./src/ui-entry.tsx", import.meta.url)),
  },
  output: {
    dir: "dist",
    entryFileNames: "[name].js",
  },
  plugins: [
    postcss({
      plugins: [atImport, tailwindcss, autoprefixer],
    }),
    importFileAsString({
      include: [
        fileURLToPath(new URL("./src/html/*.html", import.meta.url)),
        fileURLToPath(new URL("./src/img/*.svg", import.meta.url)),
      ],
    }),
    json(),
    // SWC transforms our .ts and .tsx files
    swc({ swc: swcrc, include: "src/**/*.{ts,tsx}" }),
    commonjs(),
    alias({
      entries: [
        // @walletconnect/time 1.0.2 ships ESM modules, but its package.json
        // only references the CJS modules. This causes warnings as rollup can't
        // tell that a specific name is exported from the CJS index module.
        {
          find: "@walletconnect/time",
          replacement: "@walletconnect/time/dist/esm/index.js",
        },
      ],
    }),
    nodeResolve({
      browser: true,
      preferBuiltins: true,
      extensions: [
        ...nodeResolveDefaults.extensions,
        // Without listing ts* extensions here, rollup fails to resolve imports
        // from our src/* modules. I guess because @rollup/plugin-typescript
        // includes a resolver hook for .ts extensions, but swc doesn't.
        ".ts",
        ".tsx",
      ],
    }),
    nodePolyfills(),
    replace({
      values: {
        "process.env.NODE_ENV": JSON.stringify(parseBuildMode()),
      },
      preventAssignment: true,
    }),
    copy({
      targets: [{ src: "src/assets", dest: "dist/" }],
      flatten: false,
    }),
    copy({
      targets: [
        { src: "public/*", dest: "dist/" },
        { src: "src/html/ui.html", dest: "dist/" },
        { src: "src/img/*.{png,svg}", dest: "dist/img/" },
      ],
    }),
  ],
  onLog(level, log, defaultHandler) {
    if (level === "warn") {
      const matchesIgnorePattern = IGNORED_WARNINGS.some(
        (substring) => log.message.indexOf(substring) >= 0
      );
      if (matchesIgnorePattern) return;
    }
    defaultHandler(level, log);
  },
});
