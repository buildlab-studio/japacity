import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// The game's own colours on every screen (docs/rules/world.md R-WORLD-021). The client names role tokens only; the older cream page palette and the
// tells of a machine-made app stay out. Every finding names the file and the line, so a failure says where to look.

const root = fileURLToPath(new URL("..", import.meta.url));
const CLIENT = "apps/client/src";
const SKIPPED = new Set(["node_modules", "dist", "build", "coverage"]);

const toPosix = (path: string) => path.split(sep).join("/");

function filesUnder(directory: string, keep: (rel: string) => boolean, found: string[] = []): string[] {
  for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
    const rel = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!SKIPPED.has(entry.name)) filesUnder(rel, keep, found);
    } else if (entry.isFile() && keep(rel)) {
      found.push(toPosix(relative(root, join(root, rel))));
    }
  }
  return found;
}

const clientFiles = filesUnder(CLIENT, (rel) => /\.(?:tsx?|css)$/.test(rel));

/** The files that hold the player's words: the shell's, each feature's and content's. */
const wordFiles = [
  ...filesUnder(CLIENT, (rel) => rel === `${CLIENT}/shared/words/ui.ts` || /^apps\/client\/src\/features\/[^/]+\/[^/]+\.words\.ts$/.test(rel)),
  ...filesUnder("packages/content/src", (rel) => rel.endsWith(".text.ts")),
];

interface Finding {
  readonly file: string;
  readonly line: number;
  readonly found: string;
}

function findAll(files: readonly string[], pattern: RegExp): Finding[] {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const found: Finding[] = [];
  for (const file of files) {
    readFileSync(join(root, file), "utf8")
      .split("\n")
      .forEach((text, at) => {
        for (const match of text.matchAll(new RegExp(pattern.source, flags))) found.push({ file, line: at + 1, found: match[0] });
      });
  }
  return found;
}

const show = (findings: readonly Finding[]) => findings.map((finding) => `${finding.file}:${String(finding.line)} ${finding.found}`);

// A colour utility on one of the retired names. Only the five are named by the brief; the other utilities on the
// same names (text-paper, ring-paper, decoration-line) would draw nothing once the names are gone, so they go too.
const UTILITY = String.raw`(?:bg|text|border(?:-[xytrbl])?|ring(?:-offset)?|divide|outline|decoration|fill|stroke|from|via|to|shadow|accent|caret|placeholder)`;
const RETIRED = String.raw`(?:paper|surface|sunk|muted|line)`;
const OLD_CLASS = new RegExp(String.raw`(?<![\w-])${UTILITY}-${RETIRED}(?![\w-])`);
const OLD_VARIABLE = new RegExp(String.raw`--(?:color-)?${RETIRED}(?![\w-])`);
const CREAM = /#(?:f7f1e6|fffaf1|ece2d0|ddd0ba|675e52|fbf9f4|e8e2d4|ece4cf)\b/i;

const GRADIENT_CLASS = /(?<![\w-])bg-(?:gradient|linear|radial|conic)-/;
// A gradient stop: from-scrim, from-black/60, via-indigo-500, from-[#123]. A word key ("ui.lottery.from-bank") is not one.
const GRADIENT_STOP = /(?<![\w.-])(?:from|via)-(?:[a-z]+(?:-[a-z0-9]+)*|\[[^\]\s]+\])(?:\/\d+)?(?![\w-])/;
// A soft gradient in CSS. A repeating gradient with hard stops is a stripe, not a glow.
const GRADIENT_CSS = /(?<!repeating-)(?:linear|radial|conic)-gradient\(/;
const BLUR = /backdrop-blur|backdrop-filter/;
const GLOW = /(?<![\w-])shadow-[\w-]*glow/;

// An emoji is a picture by default, or a pictograph asked to show as one. The copyright sign is a pictograph
// shown as text, so it stays.
const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}️/u;
const STOCK = /\b(?:get started|oops|seamless(?:ly)?|unlock)\b/i;

const PILL = /(?<![\w-])rounded-full(?![\w-])/;
/** A pill only where it means something: a dot, a person's avatar, the month's glyph. */
const PILLS_ALLOWED = 8;

describe("the palette", () => {
  test("[R-WORLD-021] given the walk, then it sees the client's screens, styles and words", () => {
    expect(clientFiles).toContain(`${CLIENT}/index.css`);
    expect(clientFiles).toContain(`${CLIENT}/features/activity/JobList.tsx`);
    expect(wordFiles).toContain(`${CLIENT}/shared/words/ui.ts`);
    expect(wordFiles.some((file) => file.startsWith("packages/content/src/"))).toBe(true);
  });

  test("[R-WORLD-021] given the client, when its classes are read, then none names the older page palette", () => {
    expect(show(findAll(clientFiles, OLD_CLASS))).toEqual([]);
  });

  test("[R-WORLD-021] given the client, when its styles are read, then the older palette's variables are gone", () => {
    expect(show(findAll(clientFiles, OLD_VARIABLE))).toEqual([]);
  });

  test("[R-WORLD-021] given the client, then no cream or beige of the older palette is written anywhere", () => {
    expect(show(findAll(clientFiles, CREAM))).toEqual([]);
  });

  test("[R-WORLD-021] given the client, then nothing is drawn with a gradient, a blur or a glow", () => {
    expect(show([...findAll(clientFiles, GRADIENT_CLASS), ...findAll(clientFiles, GRADIENT_STOP), ...findAll(clientFiles, GRADIENT_CSS), ...findAll(clientFiles, BLUR), ...findAll(clientFiles, GLOW)])).toEqual([]);
  });

  test("[R-WORLD-021] given the player's words, then no emoji stands in for a picture", () => {
    expect(show(findAll(wordFiles, EMOJI))).toEqual([]);
  });

  test("[R-WORLD-021] given the player's words, then no stock app copy is used", () => {
    expect(show(findAll(wordFiles, STOCK))).toEqual([]);
  });

  test(`[R-WORLD-021] given the client, then at most ${String(PILLS_ALLOWED)} things are drawn as pills`, () => {
    const pills = show(findAll(clientFiles, PILL));
    // Over the limit, every pill is listed, so the failure shows which to make square.
    expect(pills.length <= PILLS_ALLOWED ? [] : pills).toEqual([]);
  });
});
