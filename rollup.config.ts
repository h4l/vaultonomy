import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import typescript from "@rollup/plugin-typescript";
import { FilterPattern, createFilter } from "@rollup/pluginutils";
import autoprefixer from "autoprefixer";
import atImport from "postcss-import";
import { defineConfig } from "rollup";
import type { Plugin, TransformPluginContext, TransformResult } from "rollup";
import copy from "rollup-plugin-copy";
import postcss from "rollup-plugin-postcss";
import tailwindcss from "tailwindcss";
import { fileURLToPath } from "url";

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
    typescript(),
    commonjs(),
    nodeResolve({ browser: true }),
    replace({
      values: {
        "process.env.NODE_ENV": JSON.stringify(parseBuildMode()),
      },
      preventAssignment: true,
    }),
    importFileAsString({
      include: [
        fileURLToPath(new URL("./src/html/*.html", import.meta.url)),
        fileURLToPath(new URL("./src/img/*.svg", import.meta.url)),
      ],
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
});
