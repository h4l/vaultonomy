import replace from "@rollup/plugin-replace";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    // public/ui.html references ui.js which makes Vite think it should resolve
    // and compile it. But it shouldn't because ui.js is already a reference to
    // the compiled ui entry.
    exclude: ["ui.js"],
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
    // Vite emits a module that warns about node things being accessed. Its
    // named prefixed with _ and chrome seems to disallow extensions using js
    // files with _ prefixes. AFAIK nothing needs node polyfills, but libs check
    // for their presence to conditionally enable them. My intention here is to
    // not include any polyfills, but use the plugin's ability to disable Vite's
    // warnings.
    nodePolyfills({
      include: [],
      globals: {},
    }),
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
