// Draws the fixed link previews (share.md R-SHARE-010), by hand:
// `pnpm exec tsx tools/share/draw-previews.ts` from the repository root. The nine previews come from
// the client's own card code (`previewSteps` through `renderPreview`) in Chromium, served by the
// client's dev server, at `tuning.share.previewWidth` by `previewHeight` and under `previewMaxBytes`;
// the register's bytes follow. The pictures wait on a person's approval before they count as
// approved. Nothing here runs in the check.
import { type ChildProcess, spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { content, shareKinds, text, type ShareKind } from "@japacity/content";
import { chromium, type Page } from "@playwright/test";

import { isMain, readJson, REPO_ROOT } from "../repo";

const PORT = Number(process.env.PREVIEWS_PORT ?? "5871");
const BASE = `http://localhost:${String(PORT)}`;
const SHARE = join(REPO_ROOT, "apps/client/public/share");
const REGISTER = join(REPO_ROOT, "assets-src/register.json");
const DANFO = join(REPO_ROOT, "apps/client/node_modules/@fontsource/danfo/files/danfo-latin-400-normal.woff2");

/** The words a preview carries, all from content: nothing about any player. */
export function previewFace(kind: ShareKind): Record<string, string> {
  const word = (key: string) => {
    const words = text[key];
    if (words === undefined) throw new Error(`No words for ${key}.`);
    return words;
  };
  return {
    kind,
    kicker: word(`share.${kind}.kicker`),
    title: word(`share.${kind}.title`),
    art: word(`share.${kind}.art`),
    sender: word("share.sender"),
    address: word("share.address"),
    disclaimer: word("share.disclaimer"),
  };
}

async function answers(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

/** The client's dev server on its own port, so the card code runs as the game runs it. */
async function devServer(): Promise<() => void> {
  if (await answers(BASE)) throw new Error(`Something already answers at ${BASE}. Set PREVIEWS_PORT to a free port.`);
  const child: ChildProcess = spawn("pnpm", ["--filter", "@japacity/client", "exec", "vite", "--port", String(PORT), "--strictPort"], { cwd: REPO_ROOT, detached: true, stdio: "ignore" });
  const stop = () => {
    if (child.pid === undefined || child.exitCode !== null) return;
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  };
  for (let waited = 0; waited < 90; waited += 1) {
    if (await answers(BASE)) return stop;
    if (child.exitCode !== null) break;
    await new Promise((done) => setTimeout(done, 1_000));
  }
  stop();
  throw new Error(`The dev server did not start at ${BASE}.`);
}

/** One preview drawn by the client's renderer; the page's script is a string so nothing is rewritten on its way in. */
async function drawPreview(page: Page, face: Record<string, string>): Promise<{ ok: boolean; quality: number; base64: string; reason: string }> {
  return page.evaluate(`(async () => {
    const { renderPreview } = await import("/src/shared/share/render.ts");
    const made = await renderPreview(${JSON.stringify(face)});
    if (!made.ok) return { ok: false, quality: 0, base64: "", reason: made.reason };
    const bytes = new Uint8Array(await made.blob.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return { ok: true, quality: made.quality, base64: btoa(binary), reason: "" };
  })()`);
}

interface RegisterRow {
  file: string;
  bytes: number;
}

async function main(): Promise<void> {
  const tuning = content.tuning.share;
  const stop = await devServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: tuning.previewWidth, height: tuning.previewHeight }, deviceScaleFactor: 1 });
    // A bare page on the dev server's origin, so the card code's modules load from it.
    await page.route(`${BASE}/__previews`, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body></body></html>" }));
    await page.goto(`${BASE}/__previews`);
    await page.evaluate(`(async () => {
      const face = new FontFace("Danfo", Uint8Array.from(atob("${readFileSync(DANFO).toString("base64")}"), (c) => c.charCodeAt(0)));
      document.fonts.add(await face.load());
    })()`);

    const sizes = new Map<string, number>();
    for (const kind of shareKinds) {
      const made = await drawPreview(page, previewFace(kind));
      if (!made.ok) throw new Error(`The ${kind} preview was refused: ${made.reason}.`);
      const bytes = Buffer.from(made.base64, "base64");
      if (bytes.byteLength >= tuning.previewMaxBytes) throw new Error(`The ${kind} preview is ${String(bytes.byteLength)} bytes, not under ${String(tuning.previewMaxBytes)}.`);
      const file = `apps/client/public/share/${kind}.jpg`;
      writeFileSync(join(SHARE, `${kind}.jpg`), bytes);
      sizes.set(file, bytes.byteLength);
      console.log(`${file}: ${String(bytes.byteLength)} bytes at quality ${String(made.quality)}`);
    }

    const register = readJson<{ rows: RegisterRow[] }>(REGISTER);
    for (const row of register.rows) row.bytes = sizes.get(row.file) ?? row.bytes;
    writeFileSync(REGISTER, `${JSON.stringify(register, null, 2)}\n`);
    console.log("assets-src/register.json: the previews' bytes written. Run pnpm check:assets.");
  } finally {
    await browser.close();
    stop();
  }
}

// Run as a command only; the test imports the faces without drawing anything.
if (isMain(import.meta.url)) await main();
