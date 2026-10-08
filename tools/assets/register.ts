// The register (R-ASSET-009): one row per shipped file, in assets-src/register.json, with the
// fonts the signs are lettered in (R-ASSET-012). The export fills the measured columns; people
// fill the rest; the check proves the measured columns still match the files.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { RegisterRow } from "@japacity/assets";

import { SOURCE } from "./catalog";

export interface FontRow {
  family: string;
  licence: string;
  source: string;
  attribution: string;
}

export interface Register {
  note: string;
  fonts: FontRow[];
  rows: RegisterRow[];
}

export const REGISTER_PATH = join(SOURCE, "register.json");

const EMPTY: Register = {
  note: "One row per shipped file under apps/client/public/assets (docs/rules/assets.md, the register). The export writes triangles, drawCalls, materials, bytes and paletteCheck; the check proves them against the files.",
  fonts: [
    {
      family: "Danfo",
      licence: "OFL-1.1",
      source: "@fontsource/danfo 5.3.0, already a dependency of the client",
      attribution: "Danfo by Afrotype, under the SIL Open Font License 1.1",
    },
  ],
  rows: [],
};

export function readRegister(path = REGISTER_PATH): Register {
  if (!existsSync(path)) return structuredClone(EMPTY);
  return JSON.parse(readFileSync(path, "utf8")) as Register;
}

export function writeRegister(register: Register, path = REGISTER_PATH): void {
  register.rows.sort((a, b) => a.file.localeCompare(b.file));
  writeFileSync(path, `${JSON.stringify(register, null, 2)}\n`);
}

/** The row for a file, made with the defaults for our own code-built work if it is new. */
export function rowFor(register: Register, file: string, defaults: Pick<RegisterRow, "place" | "author">, today: string): RegisterRow {
  let row = register.rows.find((candidate) => candidate.file === file);
  if (row === undefined) {
    row = {
      file,
      place: defaults.place,
      source: "code",
      author: defaults.author,
      licence: "CC BY-SA 4.0",
      attribution: null,
      aiTool: "The makers, writing the model as code (R-ASSET-015)",
      date: today,
      modified: false,
      triangles: 0,
      drawCalls: 0,
      materials: 0,
      bytes: 0,
      paletteCheck: null,
      reference: [],
      outline: null,
      review: null,
      nameCheck: null,
      status: "draft",
    };
    register.rows.push(row);
  }
  return row;
}
