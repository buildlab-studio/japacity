// pnpm --filter @japacity/teaser stage [--serve 7062] [--render] [--only Stageshow|StageshowPortrait] [--stills <folder>] [--out <folder>]
// The stageshow teaser: the game's own screens as product shots, made with the stageshow kit (src/stage/kit). It builds
// the stage page (src/stage/page) into public/dist with esbuild, the bundler Remotion's own bundler carries, so
// the compositions can open it in an iframe and drive its clock frame by frame (src/stage/Stageshow.tsx).
//   --serve <port>  builds it, keeps it built on every change and serves public/ on the port, for a browser or film.mjs
//                   (http://localhost:<port>/dist/?scene=door&shape=wide)
//   --render        builds it, then renders `Stageshow` (1920 by 1080) and `StageshowPortrait` (1080 by 1920) as H.264
//                   with sound into --out (by default apps/teaser/out), and stops if a file reaches 10 MB
//   --stills <dir>  builds it, then renders the landscape's end card and the portrait's opening as PNG files into dir
// With no flag it only builds. TEASER_BROWSER names a Chromium headless shell to render with, as for pnpm teaser:render.
import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { BundlerInternals, bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

import { STAGE_STILLS } from "../src/stage/stills";

const PACKAGE = fileURLToPath(new URL("..", import.meta.url));
const PUBLIC = join(PACKAGE, "public");
const PAGE_OUT = join(PUBLIC, "dist");
const ENTRY = join(PACKAGE, "src", "stage", "page", "main.tsx");
const TARGETS = [
  { id: "Stageshow", file: "japacity-stageshow.mp4" },
  { id: "StageshowPortrait", file: "japacity-stageshow-portrait.mp4" },
] as const;
/** The same quality as the lead cut's render (render/render.ts). */
const CRF = 24;
const CAP_BYTES = 10 * 1024 * 1024;
const TIMEOUT = 180_000;
const BROWSER = process.env.TEASER_BROWSER ?? null;

const INDEX = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Japacity stage</title>
    <link rel="stylesheet" href="./kit/stageshow.css" />
    <link rel="stylesheet" href="./main.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.js"></script>
  </body>
</html>
`;

const KIT_STYLES = join(PACKAGE, "src", "stage", "kit", "stageshow.css");

type Plugin = NonNullable<NonNullable<Parameters<typeof BundlerInternals.esbuild.build>[0]>["plugins"]>[number];

/**
 * The kit's styles in a sheet of their own (dist/kit/stageshow.css), as the kit ships them, rather than in the page's:
 * each kit part's own import of its CSS is left out of the page's bundle, and the kit's sheet loads every part's at once.
 */
const kitStylesApart: Plugin = {
  name: "kit-styles-apart",
  setup(build) {
    build.onResolve({ filter: /\.css$/ }, (args) => (args.kind === "import-statement" && args.resolveDir.includes(`${sep}stage${sep}kit`) ? { path: args.path, namespace: "kit-style" } : undefined));
    build.onLoad({ filter: /.*/, namespace: "kit-style" }, () => ({ contents: "", loader: "css" }));
  },
};

const OPTIONS = {
  entryPoints: { main: ENTRY, "kit/stageshow": KIT_STYLES },
  plugins: [kitStylesApart],
  outdir: PAGE_OUT,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  jsx: "automatic",
  minify: true,
  legalComments: "none",
  loader: { ".woff2": "file", ".woff": "file", ".webp": "file", ".png": "file", ".svg": "file" },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
} satisfies Parameters<typeof BundlerInternals.esbuild.build>[0];

function value(argv: readonly string[], flag: string): string | undefined {
  const at = argv.indexOf(flag);
  return at === -1 ? undefined : argv[at + 1];
}

async function buildPage(): Promise<void> {
  rmSync(PAGE_OUT, { recursive: true, force: true });
  mkdirSync(PAGE_OUT, { recursive: true });
  writeFileSync(join(PAGE_OUT, "index.html"), INDEX);
  await BundlerInternals.esbuild.build(OPTIONS);
  console.log(`stage: the page is built into ${PAGE_OUT}`);
}

async function serve(port: number): Promise<void> {
  await buildPage();
  const context = await BundlerInternals.esbuild.context({ ...OPTIONS, minify: false });
  await context.watch();
  const { port: answered } = await context.serve({ servedir: PUBLIC, port, host: "127.0.0.1" });
  console.log(`stage: http://127.0.0.1:${String(answered)}/dist/?scene=door&shape=wide`);
}

async function render(out: string, only: string | undefined): Promise<void> {
  await buildPage();
  const serveUrl = await bundle({ entryPoint: join(PACKAGE, "src", "index.ts"), publicDir: PUBLIC, enableCaching: false });
  mkdirSync(out, { recursive: true });
  for (const target of TARGETS.filter((one) => only === undefined || one.id === only)) {
    const started = Date.now();
    const composition = await selectComposition({ serveUrl, id: target.id, timeoutInMilliseconds: TIMEOUT, browserExecutable: BROWSER });
    const output = join(out, target.file);
    // One tab: each scene's page runs its clock forward only, so frames in order never load a page twice.
    await renderMedia({ serveUrl, composition, codec: "h264", crf: CRF, imageFormat: "jpeg", jpegQuality: 92, muted: false, pixelFormat: "yuv420p", colorSpace: "bt709", outputLocation: output, timeoutInMilliseconds: TIMEOUT, browserExecutable: BROWSER, concurrency: 1 });
    const seconds = Math.round((Date.now() - started) / 1000);
    const bytes = statSync(output).size;
    console.log(`stage: ${output} ${(bytes / 1024 / 1024).toFixed(1)} MB, ${String(composition.durationInFrames / composition.fps)} s of video in ${String(seconds)} s`);
    if (bytes >= CAP_BYTES) throw new Error(`${output} is ${String(bytes)} bytes, over the 10 MB cap: raise the CRF in apps/teaser/render/stage.ts.`);
  }
}

async function stills(folder: string): Promise<void> {
  await buildPage();
  const serveUrl = await bundle({ entryPoint: join(PACKAGE, "src", "index.ts"), publicDir: PUBLIC, enableCaching: false });
  mkdirSync(folder, { recursive: true });
  for (const still of STAGE_STILLS) {
    const composition = await selectComposition({ serveUrl, id: still.id, timeoutInMilliseconds: TIMEOUT, browserExecutable: BROWSER });
    const output = join(folder, `${still.name}.png`);
    await renderStill({ serveUrl, composition, frame: still.frame, output, imageFormat: "png", timeoutInMilliseconds: TIMEOUT, browserExecutable: BROWSER });
    console.log(`stage: ${output}`);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const port = value(argv, "--serve");
  const folder = value(argv, "--stills");
  if (port !== undefined) return serve(Number(port));
  if (folder !== undefined) return stills(folder);
  if (argv.includes("--render")) return render(value(argv, "--out") ?? join(PACKAGE, "out"), value(argv, "--only"));
  return buildPage();
}

await main();
