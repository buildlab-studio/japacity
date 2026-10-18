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

/** The files that hold the player's words: content's, the interface's own among them, and the client's readers of them. */
const wordFiles = [...filesUnder("packages/content/src", (rel) => rel.endsWith(".text.ts")), ...filesUnder(CLIENT, (rel) => rel.endsWith(".words.ts"))];

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

// A colour utility on one of the five retired names, whatever the utility: one on a gone name (text-paper,
// ring-paper, decoration-line) would draw nothing, so it is caught too.
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
/**
 * The front door's rounds apart from the budget (R-WORLD-021's exception): its colour swatches and the page's round
 * stamp, one round each. The header is DoorFrame, whose round buttons are the lively layer's own class
 * (`.round-button`, as the band's thumbs are `.thumb-round`), so it draws no round of its own here.
 */
const DOOR_ROUNDS: Readonly<Record<string, number>> = {
  [`${CLIENT}/shared/frontdoor/DoorFrame.tsx`]: 0,
  [`${CLIENT}/shared/frontdoor/OwnColours.tsx`]: 1,
  [`${CLIENT}/shared/datapage/DataPage.tsx`]: 1,
};

/**
 * The two lights over the start screen (account.md R-ACCOUNT-031; R-WORLD-021's exception): a picture of everyone, not the interface, with the dusk across
 * the top and a glow for each bulb, in its own colours as the 3D world keeps its own. Its soft gradients are counted
 * apart from the rule, so the picture gains none, and nothing else in the client may draw one.
 */
const PICTURE_GRADIENTS: Readonly<Record<string, number>> = {
  [`${CLIENT}/features/account/TwoLights.tsx`]: 2,
};

describe("the palette", () => {
  test("[R-WORLD-021] given the walk, then it sees the client's screens, styles and words", () => {
    expect(clientFiles).toContain(`${CLIENT}/index.css`);
    expect(clientFiles).toContain(`${CLIENT}/features/activity/JobList.tsx`);
    expect(wordFiles).toContain("packages/content/src/ui/ui.text.ts");
    expect(wordFiles).toContain(`${CLIENT}/features/phone/phone.words.ts`);
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
    const interfaceFiles = clientFiles.filter((file) => PICTURE_GRADIENTS[file] === undefined);
    expect(show([...findAll(clientFiles, GRADIENT_CLASS), ...findAll(clientFiles, GRADIENT_STOP), ...findAll(interfaceFiles, GRADIENT_CSS), ...findAll(clientFiles, BLUR), ...findAll(clientFiles, GLOW)])).toEqual([]);
  });

  test("[R-WORLD-021] given the drawn map's water, then it is the lagoon tone in the game's one look, by day and by night, never the bands' navy (decision 0025)", () => {
    const css = readFileSync(join(root, CLIENT, "index.css"), "utf8");
    expect([...css.matchAll(/--water:\s*([^;]+);/g)].map((found) => found[1])).toEqual(["#5f9fc0"]);
    // The night paint keeps the day's water: it sets no water of its own.
    const night = css.slice(css.indexOf(':root[data-paint="night"]'), css.indexOf("}", css.indexOf(':root[data-paint="night"]')));
    expect(night).not.toContain("--water");
  });

  test("[R-WORLD-021] [R-ACCOUNT-031] given the two lights' exception, then the picture draws its dusk and its glow and no other gradient, and no blur", () => {
    for (const [file, gradients] of Object.entries(PICTURE_GRADIENTS)) {
      expect({ file, gradients: findAll([file], GRADIENT_CSS).length }).toEqual({ file, gradients });
      expect(show([...findAll([file], GRADIENT_CLASS), ...findAll([file], GRADIENT_STOP), ...findAll([file], BLUR), ...findAll([file], GLOW)])).toEqual([]);
    }
  });

  test("[R-WORLD-021] given the player's words, then no emoji stands in for a picture", () => {
    expect(show(findAll(wordFiles, EMOJI))).toEqual([]);
  });

  test("[R-WORLD-021] given the player's words, then no stock app copy is used", () => {
    expect(show(findAll(wordFiles, STOCK))).toEqual([]);
  });

  test(`[R-WORLD-021] given the client, then at most ${String(PILLS_ALLOWED)} things are drawn as pills`, () => {
    const pills = show(findAll(clientFiles.filter((file) => DOOR_ROUNDS[file] === undefined), PILL));
    // Over the limit, every pill is listed, so the failure shows which to make square.
    expect(pills.length <= PILLS_ALLOWED ? [] : pills).toEqual([]);
  });

  test("[R-WORLD-021] given the front door's exception, then its header buttons, its swatches and the page's stamp are each drawn round once, and nothing more of the door", () => {
    for (const [file, rounds] of Object.entries(DOOR_ROUNDS)) expect({ file, rounds: findAll([file], PILL).length }).toEqual({ file, rounds });
  });
});
