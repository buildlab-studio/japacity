// Regenerates the golden files from the scripts and says what changed.
// Usage: pnpm bless. Golden files change only this way (AGENTS.md rule 5).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Golden } from "../packages/sim/src/engine/golden";
import { measure } from "../packages/sim/src/engine/golden";
import type { Content } from "../packages/sim/src/engine/types";
import { miniContent } from "../packages/sim/src/testing/miniContent";
import { standInWorld } from "../packages/sim/src/world/standIn";
import { goldenScripts } from "../packages/sim/goldens/scripts";

const goldensDir = fileURLToPath(new URL("../packages/sim/goldens/", import.meta.url));

/** The content a save's version names. Real content joins this table when it lands. */
const CONTENTS: Record<string, Content> = { [miniContent.version]: miniContent };

function toImportName(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase());
}

let changed = 0;
for (const script of goldenScripts) {
  const content = CONTENTS[script.save.content];
  if (content === undefined) throw new Error(`${script.name}: no content with version ${script.save.content}.`);
  const expected = measure(script.save, content, (tick) => standInWorld(script.save.worldSeed, tick, content));
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
  'import type { Golden } from "../src/engine/golden";',
  "",
  ...goldenScripts.map((script) => `import ${toImportName(script.name)} from "./${script.name}.json";`),
  "",
  `export const goldens: Golden[] = [${goldenScripts.map((script) => `${toImportName(script.name)} as Golden`).join(", ")}];`,
  "",
].join("\n");
writeFileSync(`${goldensDir}index.ts`, index);
console.log(`\n${String(changed)} of ${String(goldenScripts.length)} goldens changed.`);
