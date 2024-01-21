import replace from "@rollup/plugin-replace";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      util: path.resolve(__dirname, "src/polyfills/util.ts"),
    },
  },
  build: {
    minify: false,
    lib: {
      entry: {
        reddit: "src/reddit-entry.ts",
        background: "src/background-entry.ts",
        ui: "src/ui-entry.tsx",
      },
      formats: ["es"],
    },
    sourcemap: true,
  },
  plugins: [
    replace({
      values: {
        // Some dependency refers to this
        "process.env.NODE_DEBUG": "false",
        // react uses this
        "process.env.NODE_ENV": "import.meta.env.MODE",
      },
      preventAssignment: true,
    }),
    react(),
  ],
});
