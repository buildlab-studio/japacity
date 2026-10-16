// After the shoot: the contact sheet. Every picture as a thumbnail with its name, in the catalog's order, opening full
// size on a tap; a screen not reached stands in its place with the reason. One page, no script beyond the viewer.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { SCREENS } from "./screens";
import { catalogDir, MISSED_FILE } from "./where";

function escape(words: string): string {
  return words.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default function teardown(): void {
  const dir = catalogDir();
  if (!existsSync(dir)) return;
  const pictures = readdirSync(dir).filter((name) => name.endsWith(".png")).sort();
  const missedFile = join(dir, MISSED_FILE);
  const missed = new Map<string, string>();
  if (existsSync(missedFile)) {
    for (const line of readFileSync(missedFile, "utf8").split("\n").filter((one) => one !== "")) {
      const entry = JSON.parse(line) as { key: string; why: string };
      missed.set(entry.key, entry.why);
    }
  }
  const run = existsSync(join(dir, "run.json")) ? (JSON.parse(readFileSync(join(dir, "run.json"), "utf8")) as { commit: string; started: number }) : { commit: "", started: Date.now() };
  const seconds = Math.round((Date.now() - run.started) / 1000);
  const took = `${String(Math.floor(seconds / 60))} min ${String(seconds % 60)} s`;

  const tiles: string[] = [];
  let area = "";
  for (const [at, screen] of SCREENS.entries()) {
    const number = String(at + 1).padStart(3, "0");
    // The screen's top first, then its pages down in order (a plain sort puts "-p2" before ".png").
    const part = (name: string) => Number(/-p(\d+)\.png$/.exec(name)?.[1] ?? "1");
    const own = pictures.filter((name) => name === `${number}-${screen.key}.png` || name.startsWith(`${number}-${screen.key}-p`)).sort((a, b) => part(a) - part(b));
    const thisArea = screen.key.split("-")[0] ?? "";
    if (thisArea !== area) {
      area = thisArea;
      tiles.push(`<h2>${escape(thisArea)}</h2>`);
    }
    if (own.length === 0) {
      const why = missed.get(screen.key) ?? "Not shot in this run.";
      tiles.push(`<figure class="missed"><div class="gap">Not reached</div><figcaption><b>${number}-${escape(screen.key)}</b><br>${escape(screen.what)}<br><i>${escape(why)}</i></figcaption></figure>`);
      continue;
    }
    for (const name of own) {
      tiles.push(`<figure><a href="${escape(name)}" data-full><img src="${escape(name)}" alt="${escape(name)}" loading="lazy"></a><figcaption><b>${escape(name.replace(/\.png$/, ""))}</b><br>${escape(screen.what)}</figcaption></figure>`);
    }
  }

  const reached = SCREENS.length - SCREENS.filter((screen, at) => !pictures.some((name) => name.startsWith(`${String(at + 1).padStart(3, "0")}-${screen.key}`))).length;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Screen catalog ${escape(run.commit)}</title>
<style>
  :root { color-scheme: light dark; --ground: #f4f1ea; --ink: #1c2233; --soft: #6b7183; --card: #ffffff; --miss: #fde8e4; }
  @media (prefers-color-scheme: dark) { :root { --ground: #141821; --ink: #eef0f5; --soft: #a3a9b8; --card: #1f2430; --miss: #3a2421; } }
  body { margin: 0; padding: 16px; background: var(--ground); color: var(--ink); font: 14px/1.4 system-ui, sans-serif; }
  header p { color: var(--soft); margin: 4px 0 0; }
  h2 { grid-column: 1 / -1; margin: 24px 0 4px; font-size: 18px; text-transform: capitalize; }
  main { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
  figure { margin: 0; background: var(--card); border-radius: 10px; padding: 6px; }
  figure img { display: block; width: 100%; height: auto; border-radius: 6px; }
  figcaption { margin-top: 6px; font-size: 12px; color: var(--soft); word-break: break-word; }
  figcaption b { color: var(--ink); }
  .missed { background: var(--miss); }
  .gap { aspect-ratio: 412 / 839; display: grid; place-items: center; border: 2px dashed var(--soft); border-radius: 6px; color: var(--soft); }
  #view { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.88); display: none; place-items: center; overflow: auto; }
  #view.open { display: grid; }
  #view img { max-width: 100vw; max-height: 100vh; }
</style>
</head>
<body>
<header>
<h1>Screen catalog</h1>
<p>Commit ${escape(run.commit)}. ${String(pictures.length)} pictures of ${String(reached)} of ${String(SCREENS.length)} screens, shot at Pixel 7 size, three device pixels to each, in ${took}. Read with CHECKLIST.md; the review is REVIEW.md.</p>
</header>
<main>
${tiles.join("\n")}
</main>
<div id="view" role="dialog" aria-label="Full size"><img alt=""></div>
<script>
  const view = document.getElementById("view");
  const big = view.querySelector("img");
  document.querySelectorAll("[data-full]").forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    big.src = link.getAttribute("href");
    big.alt = link.getAttribute("href");
    view.classList.add("open");
  }));
  view.addEventListener("click", () => view.classList.remove("open"));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") view.classList.remove("open"); });
</script>
</body>
</html>
`;
  writeFileSync(join(dir, "index.html"), html);
  console.log(`The contact sheet: ${join(dir, "index.html")} (${String(pictures.length)} pictures, ${took})`);
}
