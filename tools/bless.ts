// Regenerates the golden files from the scripts and says what changed.
// Usage: pnpm bless. Golden files change only this way (AGENTS.md rule 5).
import type { Content } from "@japacity/sim";
import { lifeStart, loadSave, standInWorld } from "@japacity/sim";
import type { Golden } from "@japacity/sim/testing";
import { measure, miniContent, goldenScripts } from "@japacity/sim/testing";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { content as realContent } from "../packages/content/src/index";

const goldensDir = fileURLToPath(new URL("../packages/sim/src/goldens/", import.meta.url));

/** The content a save's version names: the engine's mini content and the real content. */
const CONTENTS: Record<string, Content> = { [miniContent.version]: miniContent, [realContent.version]: realContent };

function toImportName(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase());
}

let changed = 0;
for (const script of goldenScripts) {
  const contents = loadSave(script.save).segments.map((segment) => {
    const content = CONTENTS[segment.content];
    if (content === undefined) throw new Error(`${script.name}: no content with version ${segment.content}.`);
    return content;
  });
  const start = lifeStart(script.save);
  if (start === null) throw new Error(`${script.name}: a golden starts a new life.`);
  // The stand-in world under the first segment's content; a golden of several contents would need stored worlds.
  const worldContent = contents[0]!;
  const expected = measure(script.save, contents, (tick) => standInWorld(start.worldSeed, tick, worldContent));
  const golden: Golden = { name: script.name, save: script.save, ...expected };
  const path = `${goldensDir}${script.name}.json`;
  const before = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Golden) : null;
  const text = `${JSON.stringify(golden, null, 2)}\n`;
  if (before === null) {
    console.log(`${script.name}: new, ${String(expected.months.length)} months, final ${expected.finalHash}`);
    changed += 1;
  } else if (before.finalHash !== expected.finalHash || JSON.stringify(before.months) !== JSON.stringify(expected.months)) {
    const firstDiff = expected.months.findIndex((month, index) => JSON.stringify(month) !== JSON.stringify(before.months[index]));
    console.log(
      `${script.name}: changed from month ${String(firstDiff < 0 ? expected.months.length : firstDiff + 1)}, final ${before.finalHash} -> ${expected.finalHash}`,
    );
    changed += 1;
  } else {
    console.log(`${script.name}: unchanged, final ${expected.finalHash}`);
  }
  writeFileSync(path, text);
}

const index = [
  "// Every blessed golden. `pnpm bless` rewrites this file.",
  'import type { Golden } from "../engine/golden";',
  "",
  ...goldenScripts.map((script) => `import ${toImportName(script.name)} from "./${script.name}.json";`),
  "",
  `export const goldens: Golden[] = [${goldenScripts.map((script) => `${toImportName(script.name)} as Golden`).join(", ")}];`,
  "",
].join("\n");
writeFileSync(`${goldensDir}index.ts`, index);
console.log(`\n${String(changed)} of ${String(goldenScripts.length)} goldens changed.`);
