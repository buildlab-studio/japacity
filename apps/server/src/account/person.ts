// account:person-kept-with-character: the person built at the door, as the server takes it with a new character and as
// `reset-name` renames it (moderation:fixed-admin-actions). Its shape, its size and its look are content's one reading
// (`readKeptPerson`, which the door's name box and the client's crowd share); its words are the username's checks.
import type { KeptPersonWire } from "@japacity/api";
import { doorLookOf, nameMix, namePool, readKeptPerson, text } from "@japacity/content";
import { drawName } from "@japacity/sim";

import { characterNameProblem } from "./username";

/** Why each refusal is said, in the server's plain words for the client's log. */
const REFUSED = {
  size: "The person is larger than 1 KB.",
  shape: "The person is not a name, a look, an archetype and colours.",
  look: "The look is not one the game ships.",
  name: "The name is not a first name the door allows.",
  format: "The name is not a first name the door allows.",
  reserved: "The name holds a reserved word.",
  blocked: "The name holds a blocked word.",
} as const;

/** The person sent with `POST /api/character`, or why it is refused. */
export function keptPersonOf(sent: unknown): { ok: true; person: KeptPersonWire } | { ok: false; detail: string } {
  const read = readKeptPerson(sent);
  if (!read.ok) return { ok: false, detail: REFUSED[read.problem] };
  const words = characterNameProblem(read.person.name);
  if (words !== null) return { ok: false, detail: REFUSED[words] };
  return { ok: true, person: read.person };
}

/** How many draws a reset makes before it gives up: every name in the pool passes the checks, so one is enough. */
const NAME_DRAWS = 8;

/**
 * moderation:fixed-admin-actions `reset-name`, account:person-kept-with-character: a first name drawn from the one pool
 * (person:one-mixed-name-pool) for the look's sex, in place of the one reported. It passes the door's checks, as the
 * generated username passes the username's.
 */
export function generatedFirstName(randomBytes: (count: number) => Uint8Array, look: string): string {
  const sex = doorLookOf(look)?.sex ?? null;
  for (let draw = 0; draw < NAME_DRAWS; draw += 1) {
    const roll = [...randomBytes(4)].reduce((sum, byte) => sum * 256 + byte, 0);
    const n = drawName(namePool, nameMix, roll, sex);
    const name = n === null ? undefined : text[`person.name.${String(n)}`];
    if (name !== undefined && characterNameProblem(name) === null) return name;
  }
  throw new Error(`No first name from the pool after ${String(NAME_DRAWS)} draws.`);
}
