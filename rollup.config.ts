import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
// import * as html from "@web/rollup-plugin-html";
import { rollupPluginHTML as html } from "@web/rollup-plugin-html";
import merge from "deepmerge";
import { RollupOptions, defineConfig } from "rollup";
import copy from "rollup-plugin-copy";
import postcss from "rollup-plugin-postcss";
import { fileURLToPath } from "url";

const commonConfig: RollupOptions = {
  plugins: [
    postcss({
      config: {
        path: fileURLToPath(new URL("./postcss.config.js", import.meta.url)),
        ctx: {},
      },
    }),
    typescript(),
    commonjs(),
    nodeResolve({ browser: true }),
  ],
  output: {
    dir: "dist",
    entryFileNames: "[name].js",
  },
};

export default [
  merge(
    commonConfig,
    defineConfig({
      input: {
        reddit: fileURLToPath(
          new URL("./src/reddit-entry.ts", import.meta.url)
        ),
      },
      output: {
        // WebExtension content scripts can't be ES6 modules currently.
        format: "iife",
        // entryFileNames: "[name].js",
      },
    })
  ),
  merge(
    commonConfig,
    defineConfig({
      input: {
        background: fileURLToPath(
          new URL("./src/background-entry.ts", import.meta.url)
        ),
      },
      output: {
        dir: "dist",
        entryFileNames: "[name].js",
      },
      plugins: [
        html({
          input: fileURLToPath(new URL("./html/*.html", import.meta.url)),
        }),
        copy({
          targets: [{ src: "public/manifest.json", dest: "dist/" }],
        }),
      ],
    })
  ),
];
