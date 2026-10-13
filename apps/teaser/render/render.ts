// pnpm teaser:render [--out <file>]
// Bundles the composition, renders the teaser as H.264 (1920 by 1080, 30 frames a second, silent) and writes it to
// docs/teaser/japacity-teaser.mp4, then says how long it took and how big it is. It stops with an error when the file is
// 10 MB or more: GitHub plays a linked mp4 from the repository on its own page, and the free plan's cap is 10 MB.
import { mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const PACKAGE = fileURLToPath(new URL("..", import.meta.url));
const ROOT = join(PACKAGE, "..", "..");
const DEFAULT_OUT = join(ROOT, "docs", "teaser", "japacity-teaser.mp4");
/** The quality, checked by eye on the stickers' edges and the night shots: a step above H.264's usual 23 keeps it under the cap. */
const CRF = 24;
const CAP_BYTES = 10 * 1024 * 1024;

function outPath(argv: readonly string[]): string {
  const at = argv.indexOf("--out");
  return at === -1 ? DEFAULT_OUT : (argv[at + 1] ?? DEFAULT_OUT);
}

async function main(): Promise<void> {
  const out = outPath(process.argv.slice(2));
  const started = Date.now();
  const serveUrl = await bundle({ entryPoint: join(PACKAGE, "src", "index.ts"), publicDir: join(PACKAGE, "public") });
  const composition = await selectComposition({ serveUrl, id: "Lead" });
  mkdirSync(dirname(out), { recursive: true });
  await renderMedia({ serveUrl, composition, codec: "h264", crf: CRF, imageFormat: "jpeg", jpegQuality: 92, muted: false, pixelFormat: "yuv420p", colorSpace: "bt709", outputLocation: out });
  const seconds = Math.round((Date.now() - started) / 1000);
  const bytes = statSync(out).size;
  console.log(`teaser:render: ${out} ${(bytes / 1024 / 1024).toFixed(1)} MB, ${String(composition.durationInFrames / composition.fps)} s of video in ${String(seconds)} s`);
  if (bytes >= CAP_BYTES) throw new Error(`The teaser is ${String(bytes)} bytes, over the 10 MB cap: raise the CRF in apps/teaser/render/render.ts.`);
}

await main();
