// The person built at the door as it travels to the server and back (account:person-kept-with-character): a first name, a
// look the game ships, the archetype it started as and the player's own colours, never the page's photo, at most
// `KEPT_PERSON_MOST_BYTES` as JSON. The door's name box and the server read the name's shape from here, so the two refuse
// the same names; the reserved and blocked words are the username's own checks, which the server runs on top.
import { z } from "zod";

import { PRESETS } from "../prologue/prologue.preset";
import { doorLookOf } from "./person.shipped.data";

export const PERSON_NAME_SHORTEST = 2;
export const PERSON_NAME_LONGEST = 20;

/** What is wrong with a name's shape: too short, too long, or holding something other than letters. */
export type PersonNameShape = "short" | "long" | "letters";

/** A letter and the marks over and under it (Adébáyọ̀, Ọlá), and nothing else. */
const LETTERS = /^[\p{L}\p{M}]+$/u;

/** The problem with a first name's shape once trimmed, or null when it may be the character's. Letters only, counted without their marks. */
export function personNameShape(typed: string): PersonNameShape | null {
  const name = typed.trim();
  const length = [...name.normalize("NFC")].filter((each) => !/\p{M}/u.test(each)).length;
  if (length < PERSON_NAME_SHORTEST) return "short";
  if (length > PERSON_NAME_LONGEST) return "long";
  if (!LETTERS.test(name)) return "letters";
  return null;
}

/** The most a kept person may take as JSON, in bytes. */
export const KEPT_PERSON_MOST_BYTES = 1024;

/** A colour of the palette or a fabric, by its name: paint only, never a stat. */
const PAINT = z.string().regex(/^[A-Za-z0-9-]{1,24}$/);

/** account:person-kept-with-character: the kept person's shape. No other key is taken, the photo least of all. */
export const keptPersonSchema = z.strictObject({
  name: z
    .string()
    .refine((name) => name === name.trim() && personNameShape(name) === null),
  look: z.string().refine((look) => doorLookOf(look) !== null),
  archetype: z
    .string()
    .refine((id) => PRESETS.some((preset) => preset.id === id))
    .nullable(),
  style: z.strictObject({ skin: PAINT.optional(), hair: PAINT.optional(), top: PAINT.optional(), fabric: PAINT.optional() }).optional(),
});

/** The person as read: the schema's shape with every part it was not sent left out. */
export interface KeptPersonShape {
  name: string;
  look: string;
  archetype: string | null;
  style?: { skin?: string; hair?: string; top?: string; fabric?: string };
}

/** The parts of a style that were sent, and no key for the rest. */
function sentParts(style: Partial<Record<"skin" | "hair" | "top" | "fabric", string | undefined>>): NonNullable<KeptPersonShape["style"]> {
  return Object.fromEntries(Object.entries(style).filter(([, value]) => value !== undefined));
}

/** A text's length in UTF-8 bytes, as it travels. */
function utf8Bytes(text: string): number {
  let bytes = 0;
  for (const each of text) {
    const point = each.codePointAt(0) ?? 0;
    bytes += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** Why a person sent is not kept: too large, a name or a look the game refuses, or any other shape. */
export type KeptPersonProblem = "size" | "name" | "look" | "shape";

/** The person as sent, read against the shape and the size, or the first reason it is refused. */
export function readKeptPerson(sent: unknown): { ok: true; person: KeptPersonShape } | { ok: false; problem: KeptPersonProblem } {
  const json = JSON.stringify(sent) as string | undefined;
  if (json === undefined || utf8Bytes(json) > KEPT_PERSON_MOST_BYTES) return { ok: false, problem: json === undefined ? "shape" : "size" };
  const read = keptPersonSchema.safeParse(sent);
  if (read.success) {
    const { style, ...rest } = read.data;
    return { ok: true, person: style === undefined ? rest : { ...rest, style: sentParts(style) } };
  }
  const at = read.error.issues[0]?.path[0];
  return { ok: false, problem: at === "name" ? "name" : at === "look" ? "look" : "shape" };
}
