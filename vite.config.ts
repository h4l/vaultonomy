import replace from "@rollup/plugin-replace";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        background: "src/background-entry.ts",
        reddit: "src/reddit.ts",
        ui: "index.html",
      },
      output: {
        dir: "dist",
        entryFileNames: "[name].js",
      },
    },
  },
  plugins: [
    replace({
      values: {
        // Some dependency refers to this
        "process.env.NODE_DEBUG": JSON.stringify(false),
      },
      preventAssignment: true,
    }),
    react(),
  ],
});
