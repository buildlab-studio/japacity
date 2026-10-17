// pnpm teaser:render [--only Lead|LeadPortrait] [--stills <folder>]
// Bundles the compositions and renders the teaser in its two frames as H.264 with its sound: the landscape teaser (1920
// by 1080) to docs/teaser/japacity-teaser.mp4 and the portrait one for a phone's feed (1080 by 1920) to
// docs/teaser/japacity-teaser-portrait.mp4, 30 frames a second, then says how long each took and how big it is. It stops
// with an error when a file is 10 MB or more: GitHub plays a linked mp4 from the repository on its own page, and the free
// plan's cap is 10 MB. With --stills it renders the cut's named moments (src/a branch.ts) as PNG files into the folder
// instead. TEASER_BROWSER names a Chromium headless shell to render with in place of the one Remotion downloads,
// for a machine where that one does not open the bundle (Playwright's own, under ~/Library/Caches/ms-playwright, does).
import { mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

import { STILLS } from "../src/a branch";

const PACKAGE = fileURLToPath(new URL("..", import.meta.url));
const ROOT = join(PACKAGE, "..", "..");
const TARGETS = [
  { id: "Lead", out: join(ROOT, "docs", "teaser", "japacity-teaser.mp4") },
  { id: "LeadPortrait", out: join(ROOT, "docs", "teaser", "japacity-teaser-portrait.mp4") },
] as const;
/** The quality, checked by eye on the stickers' edges and the night shots: a step above H.264's usual 23 keeps it under the cap. */
const CRF = 24;
const CAP_BYTES = 10 * 1024 * 1024;
/** A loaded machine can take a while to open the bundle; the default half minute is too short for it. */
const TIMEOUT = 180_000;
const BROWSER = process.env.TEASER_BROWSER ?? null;

function value(argv: readonly string[], flag: string): string | undefined {
  const at = argv.indexOf(flag);
  return at === -1 ? undefined : argv[at + 1];
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const only = value(argv, "--only");
  const stills = value(argv, "--stills");
  // The bundler's cache on disk is left off: a render is rare, and on a loaded machine the cache's first write was seen to
  // stall the bundle for good.
  const serveUrl = await bundle({ entryPoint: join(PACKAGE, "src", "index.ts"), publicDir: join(PACKAGE, "public"), enableCaching: false });
  if (stills !== undefined) {
    mkdirSync(stills, { recursive: true });
    for (const still of STILLS) {
      const inputProps = still.feed === true ? { feed: true } : {};
      const composition = await selectComposition({ serveUrl, id: still.id, inputProps, timeoutInMilliseconds: TIMEOUT, browserExecutable: BROWSER });
      const output = join(stills, `${still.name}.png`);
      await renderStill({ serveUrl, composition, frame: still.frame, output, inputProps, imageFormat: "png", timeoutInMilliseconds: TIMEOUT, browserExecutable: BROWSER });
      console.log(`teaser:render: ${output}`);
    }
    return;
  }
  for (const target of TARGETS.filter((one) => only === undefined || one.id === only)) {
    const started = Date.now();
    const composition = await selectComposition({ serveUrl, id: target.id, timeoutInMilliseconds: TIMEOUT, browserExecutable: BROWSER });
    mkdirSync(dirname(target.out), { recursive: true });
    await renderMedia({ serveUrl, composition, codec: "h264", crf: CRF, imageFormat: "jpeg", jpegQuality: 92, muted: false, pixelFormat: "yuv420p", colorSpace: "bt709", outputLocation: target.out, timeoutInMilliseconds: TIMEOUT, browserExecutable: BROWSER });
    const seconds = Math.round((Date.now() - started) / 1000);
    const bytes = statSync(target.out).size;
    console.log(`teaser:render: ${target.out} ${(bytes / 1024 / 1024).toFixed(1)} MB, ${String(composition.durationInFrames / composition.fps)} s of video in ${String(seconds)} s`);
    if (bytes >= CAP_BYTES) throw new Error(`${target.out} is ${String(bytes)} bytes, over the 10 MB cap: raise the CRF in apps/teaser/render/render.ts.`);
  }
}

await main();
