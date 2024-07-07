import replace from "@rollup/plugin-replace";
import react from "@vitejs/plugin-react-swc";
import { readFile } from "fs/promises";
import { parse as semverParse } from "semver";
import { Plugin, defineConfig, loadEnv } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { z } from "zod";

import { transformFunctionConstructorReturnThis } from "./build/rollup-plugin-function-constructor-return-this";
import {
  BrowserTarget,
  ReleaseTarget,
  VaultonomyConfigDev,
  VaultonomyConfigProd,
  VaultonomyDevConfig,
  VaultonomyGlobal,
  VaultonomyStatsConfig,
} from "./src/global";

type BuildMode = {
  releaseTarget: ReleaseTarget;
  browserTarget: BrowserTarget;
};

const MODE_PATTERN = /^(development|production)(?:-(chrome|firefox))?$/;

const BuildMode = z.string().transform((arg, ctx): BuildMode => {
  const [_, releaseTarget, browserTarget] = MODE_PATTERN.exec(arg) || [];
  if (!releaseTarget) {
    ctx.addIssue({
      code: "custom",
      message: `Build mode must match ${MODE_PATTERN}`,
    });
    return z.NEVER;
  }
  return {
    releaseTarget: releaseTarget as ReleaseTarget,
    browserTarget: (browserTarget as BrowserTarget | undefined) || "chrome",
  };
});

type WebextensionManifestOptions = {
  source: string;
  browserTarget: BrowserTarget;
  releaseTarget: ReleaseTarget;
};

const Icons = z.record(z.string().regex(/^\d+$/), z.string());

const BaseWebExtensionManifest = z
  .object({
    name: z.string(),
    version: z.undefined({
      message:
        "The version is generated from the package.json version; version in the source manifest must not be set.",
    }),
    version_name: z.undefined({
      message:
        "The version_name is generated from the package.json version; version_name in the source manifest must not be set.",
    }),
    icons: Icons,
    permissions: z.array(z.string()),
  })
  .passthrough();

const SourceChromeWebExtensionManifest = BaseWebExtensionManifest.extend({
  background: z
    .object({
      service_worker: z.string(),
      type: z.literal("module"),
    })
    .strict(),
  side_panel: z.object({ default_path: z.string() }),
});
type SourceChromeWebExtensionManifest = z.infer<
  typeof SourceChromeWebExtensionManifest
>;

const ChromeWebExtensionManifest = SourceChromeWebExtensionManifest.extend({
  version: z.string(),
  version_name: z.string().optional(),
  externally_connectable: z
    .object({
      ids: z.array(z.string()).optional(),
      matches: z.array(z.string()).optional(),
    })
    .optional(),
});
type ChromeWebExtensionManifest = z.infer<typeof ChromeWebExtensionManifest>;

const FirefoxWebExtensionManifest = BaseWebExtensionManifest.extend({
  version: z.string(),
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

interface ManifestVersion {
  version: string;
  version_name?: string;
}

/** Get the version and version_name to use in the extension manifest.
 *
 * See {@link ./docs/version-numbers.md} for our version number rules and
 * justification.
 */
function getManifestVersion({ version }: PackageJsonMeta): ManifestVersion {
  const invalidMsg = (reason: string) =>
    `Invalid package.json version: ${version.version}: ${reason}`;
  if (version.build.length !== 0) {
    throw new Error(invalidMsg("+xxx build identifier is not allowed"));
  }
  if (version.prerelease.length === 0) {
    if (version.patch % 2 === 1) {
      throw new Error(
        invalidMsg("non-pre-release versions must have an even patch number"),
      );
    }
    return { version: version.version };
  }
  if (version.prerelease.length !== 2) {
    throw new Error(
      invalidMsg("pre-release version must have 0 or 2 components"),
    );
  }
  if (version.patch % 2 !== 1) {
    throw new Error(
      invalidMsg("pre-release versions must have an odd patch number"),
    );
  }
  const {
    major,
    minor,
    patch,
    prerelease: [preType, preNum],
  } = version;
  if (!(typeof preType === "string" && typeof preNum === "number")) {
    throw new Error(invalidMsg("pre-release must be <name>.<num>"));
  }
  return {
    version: `${major}.${minor}.${patch}.${preNum}`,
    version_name: version.version,
  };
}

function webextensionManifest({
  source,
  browserTarget,
  releaseTarget,
}: WebextensionManifestOptions): Plugin {
  return {
    name: "webextension-manifest",
    // Only use this plugin in regular builds, not devserver. manifest.json is
    // not needed in the devserver, and emitFile() is not supported in the
    // devserver.
    apply: "build",
    async buildStart(_options) {
      const packageJsonMeta = await readPackageJsonMeta();

      let sourceManifest: SourceChromeWebExtensionManifest;
      try {
        sourceManifest = SourceChromeWebExtensionManifest.parse(
          JSON.parse(await readFile(source, { encoding: "utf-8" })),
        );
      } catch (error) {
        throw new Error(
          `Failed to load webextension manifest from source: ${source}; ${error}`,
        );
      }

      const manifestVersion = getManifestVersion(packageJsonMeta);

      let outputManifest:
        | ChromeWebExtensionManifest
        | FirefoxWebExtensionManifest;
      if (browserTarget === "chrome") {
        outputManifest = {
          version: manifestVersion.version,
          version_name: manifestVersion.version_name,
          // In development the UI can run from the vite devserver to allow for
          // hot reloading. externally_connectable allows for specific origins
          // to establish Port connects to achieve this. It's always off in
          // production.
          // Note that Firefox doesn't support externally_connectable.
          externally_connectable:
            releaseTarget === "development" ?
              { matches: ["http://vaultonomy.localhost:5173/*"] }
            : undefined,
          ...sourceManifest,
        } satisfies ChromeWebExtensionManifest;
      } else {
        const {
          name,
          icons,
          side_panel,
          permissions,
          ...filteredSourceManifest
        } = sourceManifest;

        const firefoxManifest = {
          ...filteredSourceManifest,
          // Firefox doesn't support version_name, so we put the version_name
          // into the extension name. This only applies to pre-release versions.
          name:
            manifestVersion.version === manifestVersion.version_name ?
              name
            : `${name} (${manifestVersion.version_name})`,
          version: manifestVersion.version,
          icons,
          browser_specific_settings: {
            gecko: {
              id: "vaultonomy@h4l.users.github.com",
              // storage.session requires 115
              strict_min_version: "115.0",
            },
          },
          // Firefox doesn't use sidePanel permission
          permissions: permissions.filter((p) => p != "sidePanel"),
          background: {
            scripts: [sourceManifest.background.service_worker],
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

const PackageJsonMeta = z.object({
  version: z.string().transform((arg, ctx) => {
    const version = semverParse(arg);
    // const match = /^(\d+\.\d+\.\d+)(?:[^\d]\S*)?$/.exec(arg);
    // const [fullVersion, strictVersion] = match || [];
    if (!version) {
      ctx.addIssue({
        code: "custom",
        message: `Invalid version`,
      });
      return z.NEVER;
    }
    return version;
  }),
});
type PackageJsonMeta = z.infer<typeof PackageJsonMeta>;

async function readPackageJsonMeta(): Promise<PackageJsonMeta> {
  try {
    return PackageJsonMeta.parse(
      JSON.parse(await readFile("package.json", { encoding: "utf-8" })),
    );
  } catch (error) {
    throw new Error(`Failed to load package.json metadata: ${error}`);
  }
}

const StatsEnvVars = z
  .object({
    VITE_VAULTONOMY_STATS_API_SECRET: z.string().min(1),
    VITE_VAULTONOMY_STATS_MEASUREMENT_ID: z.string().min(1),
    VITE_VAULTONOMY_STATS_ENDPOINT: z.string().url(),
    VITE_VAULTONOMY_STATS_CLIENT_ID: z.string().uuid(),
  })
  .transform(
    (arg): VaultonomyStatsConfig => ({
      api_secret: arg.VITE_VAULTONOMY_STATS_API_SECRET,
      measurement_id: arg.VITE_VAULTONOMY_STATS_MEASUREMENT_ID,
      client_id: arg.VITE_VAULTONOMY_STATS_CLIENT_ID,
      endpoint: arg.VITE_VAULTONOMY_STATS_ENDPOINT,
    }),
  );
type StatsEnvVars = z.infer<typeof StatsEnvVars>;

function loadStatsConfigProd(
  env: Record<string, string>,
): Readonly<VaultonomyStatsConfig> {
  const result = StatsEnvVars.safeParse(env);
  if (!result.success) {
    throw new Error(
      `VITE_VAULTONOMY_STATS_* are not correctly set in production build: ${result.error}`,
    );
  }
  return result.data;
}

function loadStatsConfigDev(
  env: Record<string, string>,
): Readonly<VaultonomyStatsConfig> | null {
  const result = StatsEnvVars.safeParse(env);
  if (!result.success) return null;
  return result.data;
}

const DevEnvVars = z.object({
  VITE_TANSTACK_QUERY_DEV_TOOLS: z
    .string()
    .transform((x) => x || undefined)
    .pipe(z.boolean().default(false)),
  VITE_VAULTONOMY_DEV_EXTENSION_ID: z.string().min(1),
});

function loadVaultonomyDevConfig(
  env: Record<string, string>,
): VaultonomyDevConfig {
  const devEnvResult = DevEnvVars.safeParse(env);
  if (!devEnvResult.success) {
    throw new Error(
      `Env vars are not set correctly in file '.env.development': ${devEnvResult.error}}`,
    );
  }

  return {
    extensionId: devEnvResult.data.VITE_VAULTONOMY_DEV_EXTENSION_ID,
    tanstackQueryDevToolsEnabled:
      devEnvResult.data.VITE_TANSTACK_QUERY_DEV_TOOLS,
  };
}

async function loadVaultonomyGlobal({
  releaseTarget,
  browserTarget,
}: BuildMode): Promise<VaultonomyGlobal> {
  const env = await loadEnv(releaseTarget, process.cwd());
  const packageJsonMeta = await readPackageJsonMeta();

  let config: VaultonomyConfigProd | VaultonomyConfigDev;
  if (releaseTarget === "production") {
    config = {
      releaseTarget,
      browserTarget,
      version: packageJsonMeta.version.version,
      stats: loadStatsConfigProd(env),
      dev: null,
    } satisfies VaultonomyConfigProd;
  } else {
    config = {
      releaseTarget,
      browserTarget,
      version: packageJsonMeta.version.version,
      stats: loadStatsConfigDev(env),
      dev: loadVaultonomyDevConfig(env),
    } satisfies VaultonomyConfigDev;
  }

  return { VAULTONOMY: config };
}

// https://vitejs.dev/config/
export default defineConfig(async (options) => {
  const { releaseTarget, browserTarget } = BuildMode.parse(options.mode);
  console.log(`Building ${releaseTarget} mode for browser ${browserTarget}`);

  return defineConfig({
    optimizeDeps: {
      // public/ui.html references ui.js which makes Vite think it should resolve
      // and compile it. But it shouldn't because ui.js is already a reference to
      // the compiled ui entry.
      exclude: ["ui.js"],
    },
    define: await loadVaultonomyGlobal({ releaseTarget, browserTarget }),
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
      // Fix modules that use `Function("return this")()` instead of globalThis.
      transformFunctionConstructorReturnThis({
        include: [
          "**/lodash.*/**",
          "**/lodash/**",
          "**/@walletconnect/universal-provider/**",
        ],
      }),
      webextensionManifest({
        source: "src/manifest.json",
        browserTarget,
        releaseTarget,
      }),
      // MetaMask's modules use a node streams API polyfill which expect the
      // Buffer and process node globals to exist.
      nodePolyfills({
        // These are only used via globals, but if the include array is empty,
        // all modules get included.
        include: ["buffer", "process"],
        globals: {
          Buffer: true,
          process: true,
          global: false,
        },
      }),
      replace({
        values: {
          // Some dependency refers to this
          "process.env.NODE_DEBUG": "false",
          // react uses this
          "process.env.NODE_ENV": JSON.stringify(releaseTarget),
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
