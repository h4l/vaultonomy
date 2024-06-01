import replace from "@rollup/plugin-replace";
import react from "@vitejs/plugin-react-swc";
import { readFile } from "fs/promises";
import { Plugin, defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { z } from "zod";

const BrowserTarget = z
  .string()
  .transform((arg) =>
    /(?:\b|[_])firefox(?:\b|[_])/.test(arg) ? "firefox" : "chrome",
  )
  .pipe(z.enum(["chrome", "firefox"]));
type BrowserTarget = z.infer<typeof BrowserTarget>;

type WebextensionManifestOptions = {
  source: string;
  browserTarget: BrowserTarget;
};

const Icons = z.record(z.string().regex(/^\d+$/), z.string());

const BaseWebExtensionManifest = z
  .object({
    name: z.string(),
    version: z.string().optional(),
    icons: Icons,
    permissions: z.array(z.string()),
  })
  .passthrough();

const ChromeWebExtensionManifest = BaseWebExtensionManifest.extend({
  background: z
    .object({
      service_worker: z.string(),
      type: z.literal("module"),
    })
    .strict(),
  side_panel: z.object({ default_path: z.string() }),
  externally_connectable: z
    .object({
      ids: z.array(z.string()).optional(),
      matches: z.array(z.string()).optional(),
    })
    .optional(),
});
type ChromeWebExtensionManifest = z.infer<typeof ChromeWebExtensionManifest>;

const FirefoxWebExtensionManifest = BaseWebExtensionManifest.extend({
  browser_specific_settings: z.object({
    gecko: z.object({
      id: z.literal("vaultonomy@h4l.users.github.com"),
      strict_min_version: z.string().regex(/^[0-9]{1,3}(\.[a-z0-9]+)+$/),
    }),
  }),
  background: z
    .object({
      scripts: z.string().array(),
      type: z.literal("module"),
    })
    .strict(),
  sidebar_action: z.object({
    default_icon: Icons,
    default_title: z.string(), // "My Extension"
    default_panel: z.string(), //"sidebar/sidebar.html",
    // open_at_install: z.boolean().optional(),
  }),
});
type FirefoxWebExtensionManifest = z.infer<typeof FirefoxWebExtensionManifest>;

function webextensionManifest({
  source,
  browserTarget,
}: WebextensionManifestOptions): Plugin {
  return {
    name: "webextension-manifest",
    // Only use this plugin in regular builds, not devserver. manifest.json is
    // not needed in the devserver, and emitFile() is not supported in the
    // devserver.
    apply: "build",
    async buildStart(options) {
      let chromeManifest: ChromeWebExtensionManifest;
      try {
        chromeManifest = ChromeWebExtensionManifest.parse(
          JSON.parse(await readFile(source, { encoding: "utf-8" })),
        );
      } catch (error) {
        throw new Error(
          `Failed to load webextension manifest from source: ${source}; ${error}`,
        );
      }

      let outputManifest:
        | ChromeWebExtensionManifest
        | FirefoxWebExtensionManifest;
      if (browserTarget === "chrome") {
        outputManifest = chromeManifest;
      } else {
        // Firefox doesn't support externally_connectable.
        const {
          externally_connectable: _,
          name,
          icons,
          side_panel,
          permissions,
          ...filteredChromeManifest
        } = chromeManifest;

        const firefoxManifest = {
          ...filteredChromeManifest,
          name,
          icons,
          browser_specific_settings: {
            gecko: {
              id: "vaultonomy@h4l.users.github.com",
              // TODO: check sidebar min version
              strict_min_version: "109.0",
            },
          },
          // Firefox doesn't use sidePanel permission
          permissions: permissions.filter((p) => p != "sidePanel"),
          background: {
            scripts: [chromeManifest.background.service_worker],
            type: "module",
          },
          sidebar_action: {
            default_icon: icons,
            default_title: name,
            default_panel: side_panel.default_path,
          },
        } satisfies FirefoxWebExtensionManifest;

        try {
          outputManifest = FirefoxWebExtensionManifest.parse(firefoxManifest);
        } catch (error) {
          throw new Error(
            `failed to generate valid web extension manifest for Firefox: ${error}`,
          );
        }
      }

      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        needsCodeReference: false,
        source: JSON.stringify(outputManifest, undefined, 2),
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig((options) => {
  const browserTarget = BrowserTarget.parse(options.mode);
  console.log(`Building for browser target ${browserTarget}`);

  return defineConfig({
    optimizeDeps: {
      // public/ui.html references ui.js which makes Vite think it should resolve
      // and compile it. But it shouldn't because ui.js is already a reference to
      // the compiled ui entry.
      exclude: ["ui.js"],
    },
    build: {
      outDir: `dist/${browserTarget}`,
      minify: false,
      lib: {
        entry: {
          reddit: "src/reddit-entry.ts",
          "reddit-detect-user-interest":
            "src/reddit/ui/detect-user-interest.ts",
          background: "src/background-entry.ts",
          ui: "src/ui-entry.tsx",
        },
        formats: ["es"],
      },
      sourcemap: true,
    },
    plugins: [
      webextensionManifest({ source: "src/manifest.json", browserTarget }),
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
    esbuild: {
      // TODO: tweak this. In theory we can remove console.warn by marking it as
      // pure, but we disable minify so pure functions get marked but not removed.
      // We do this to avoid @metamask/object-multiplex/ logging spurious warning.
      pure: ["console.warn"],
    },
  });
});
