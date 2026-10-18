// How a build for players is made: minified and
// hashed as Vite already does, with no source maps, no console chatter or debugger statement, and the licences of the
// libraries it bundles in a file beside the page. Nothing is obfuscated beyond minifying. A development build
// (`--mode development`) keeps everything, so a tester can still read the console. Runs in Node, from vite.config.ts.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { BuildEnvironmentOptions, Plugin } from "vite";

/**
 * The console calls a build for players drops. Two stay: `console.error`, through which the app's boundary says a
 * screen that broke (analytics:client-sends-interface-counts, CountedBoundary.tsx) and the libraries report a real fault, and
 * `console.info`, the one line that says the build (server:production-and-staging, stamp.ts).
 */
const DROPPED_CONSOLE = [
  "console.log",
  "console.debug",
  "console.warn",
  "console.trace",
  "console.dir",
  "console.dirxml",
  "console.table",
  "console.group",
  "console.groupCollapsed",
  "console.groupEnd",
  "console.time",
  "console.timeLog",
  "console.timeEnd",
  "console.count",
  "console.countReset",
  "console.assert",
  "console.profile",
  "console.profileEnd",
] as const;

/** The file beside the page that holds every bundled library's licence, as each package ships it. */
export const LICENCES_FILE = "licenses.txt";

/** Whether a `vite build` in this mode is one for players: every mode but development (production and staging alike). */
export function forPlayers(command: "build" | "serve", mode: string): boolean {
  return command === "build" && mode !== "development";
}

/** The build settings for players. */
export function shippedBuild(): BuildEnvironmentOptions {
  return {
    sourcemap: false,
    license: { fileName: LICENCES_FILE },
    rolldownOptions: {
      // A call named here whose result is not used is dropped, its arguments kept where they do something.
      treeshake: { manualPureFunctions: [...DROPPED_CONSOLE] },
      output: {
        minify: { compress: { dropDebugger: true }, mangle: true, codegen: true },
        // engine:first-download-has-budget: the 3D library and the model loader are chunks of their own, whatever imports
        // the entry, so they are cached across releases and measured apart from the game's own code.
        codeSplitting: {
          groups: [
            { name: "three", test: /[\\/]node_modules[\\/]three[\\/]build[\\/]/, priority: 2 },
            { name: "load", test: /[\\/]node_modules[\\/]three[\\/]examples[\\/]jsm[\\/]|[\\/]packages[\\/]assets[\\/]src[\\/]load\.ts$|[\\/]src[\\/]shared[\\/]three[\\/]load\.ts$/, priority: 1 },
          ],
        },
      },
    },
  };
}

/**
 * The packages the page's styles bring in (index.css imports them): the fonts and Tailwind. Vite's licence file
 * covers what the scripts bundle; these go in through the styles, so their licences are added to it here.
 */
const STYLE_PACKAGES = ["@fontsource/danfo", "@fontsource/rubik", "tailwindcss"] as const;

/** One package's entry in the licences file, in the form Vite writes the others: name, version, licence, its text. */
function licenceEntry(packageFolder: string): string {
  const own = JSON.parse(readFileSync(join(packageFolder, "package.json"), "utf8")) as { name: string; version?: string; license?: string };
  const file = readdirSync(packageFolder).find((name) => /^(?:license|licence|copying)(?:\.\w+)?$/i.test(name));
  const text = file === undefined ? "" : `\n${readFileSync(join(packageFolder, file), "utf8").trim()}\n`;
  return `\n## ${own.name} - ${own.version ?? "0.0.0"}${own.license === undefined ? "" : ` (${own.license})`}\n${text}`;
}

/** Adds the style packages' licences to the licences file once Vite has written it. Only in a build for players. */
export function styleLicences(packages: readonly string[] = STYLE_PACKAGES): Plugin {
  let root = "";
  return {
    name: "japacity-style-licences",
    apply: (_config, { command, mode }) => forPlayers(command, mode),
    enforce: "post",
    configResolved(config) {
      root = config.root;
    },
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const file = bundle[LICENCES_FILE];
        if (file === undefined || file.type !== "asset") return;
        const entries = packages.map((name) => licenceEntry(join(root, "node_modules", name))).join("");
        file.source = `${typeof file.source === "string" ? file.source : new TextDecoder().decode(file.source)}${entries}`;
      },
    },
  };
}
