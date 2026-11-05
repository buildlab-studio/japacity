// @vitest-environment node
// The stageshow teaser says only what the game says: each word it shows is read from packages/content's text files
// and filled as the game fills it.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { type Word, WORDS } from "./words";

const CONTENT = fileURLToPath(new URL("../../../../packages/content/src", import.meta.url));

/** Every text file of content as the game ships it today: the older versions kept for old saves are left out. */
function textFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return name === "older" ? [] : textFiles(path);
    return name.endsWith(".text.ts") ? [path] : [];
  });
}

const SOURCE = textFiles(CONTENT)
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

function contentText(key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const found = new RegExp(`"${escaped}":\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(SOURCE);
  return found?.[1] === undefined ? null : (JSON.parse(`"${found[1]}"`) as string);
}

function filled(template: string, params: Readonly<Record<string, string>> = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => params[name] ?? whole);
}

function shownAs(text: string, shown: Word["shown"]): string {
  if (shown === "raised") return text.charAt(0).toUpperCase() + text.slice(1);
  if (shown === "lowered") return text.charAt(0).toLowerCase() + text.slice(1);
  return text;
}

describe("the stageshow teaser's words", () => {
  for (const [name, one] of Object.entries(WORDS) as [string, Word][]) {
    test(`given the game's text for ${one.key}, when the teaser shows ${name}, then it says what the game says`, () => {
      const template = contentText(one.key);
      const said = template !== null && (one.part === true ? template.includes(shownAs(one.text, "lowered")) : one.text === shownAs(filled(template, one.params), one.shown));
      expect(said, `"${one.text}" against ${one.key}: ${String(template)}`).toBe(true);
    });
  }
});
