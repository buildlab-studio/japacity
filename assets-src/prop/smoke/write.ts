/// <reference types="node" />
// Writes the finished smoke puff (puff.ts) into the client, where the motion code draws it.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { puffArrays } from "./puff";

export const PUFF_DATA = join(import.meta.dirname, "..", "..", "..", "apps", "client", "src", "shared", "three", "puff.data.ts");

export function puffSource(): string {
  const { positions, index } = puffArrays();
  return [
    "// The smoke puff's finished triangles, written by assets-src/prop/smoke/write.ts from puff.ts. Never edited by hand:",
    "// the blend and the thinning run when the game is built (assets.md R-ASSET-026), never on the phone.",
    `export const PUFF_POSITIONS: readonly number[] = ${JSON.stringify(positions)};`,
    `export const PUFF_INDEX: readonly number[] = ${JSON.stringify(index)};`,
    "",
  ].join("\n");
}

if (process.argv[1] !== undefined && import.meta.filename === process.argv[1]) writeFileSync(PUFF_DATA, puffSource());
