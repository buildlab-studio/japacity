// The archetypes' presets of the prologue's answers (prologue.md R-PROLOGUE-010; server.md R-SERVER-046): for each
// tile, the answers to send at each step in order of preference, held here so the client offline and the server online
// play one source. Never read by the simulation. Every step has its answer: the preset's first that is allowed, and where
// a draw has shut them all, the open answer that suits the tile (`presetAnswer`), so no card shows for a new life. The
// tile's words, pictures and routes stay with the client.
import type { PrologueStep } from "@japacity/sim";
import { int } from "@japacity/sim";

import { tuning } from "../tuning/tuning.data";
import { prologueTable } from "./prologue.data";

const AGE = "quality.age-months";
const YEAR = 12;
/** An age card's answer: the year the life starts at (R-PROLOGUE-004). */
const START = /^start-(\d+)$/;

/** The year an age card's answer picks, or null for any other answer. */
export function startYearOf(answer: string): number | null {
  const found = START.exec(answer);
  return found === null ? null : Number(found[1]);
}

/** The age cards (R-PROLOGUE-004, decision 0023): the steps whose answers are all years, one for each path after school. */
export const AGE_CARDS: readonly string[] = Object.values(prologueTable)
  .filter((step) => step.answers.length > 0 && step.answers.every((answer) => startYearOf(answer.id) !== null))
  .map((step) => step.id);

/** An age card's years, youngest first, so the first open one is the year its path reaches. */
function cardYears(card: string): string[] {
  return [...(prologueTable[card]?.answers ?? [])].sort((a, b) => (startYearOf(a.id) ?? 0) - (startYearOf(b.id) ?? 0)).map((answer) => answer.id);
}

/** The oldest year an age card offers: no step on the door goes past it (R-PROLOGUE-009). */
const OLDEST = Math.max(...AGE_CARDS.flatMap((card) => cardYears(card).map((id) => startYearOf(id) ?? 0)));

/** How many years older than its own a tile's age steps on the door (R-PROLOGUE-009: a few years). */
export const PRESET_STEPS_OLDER = 3;

export type PresetId = "developer" | "nurse" | "accountant" | "writer" | "trader" | "shop-worker" | "water";

/** The answers a preset sends at each step, in order of preference: the first allowed is sent. */
export type PresetAnswers = Readonly<Record<string, readonly string[]>>;

export interface Preset {
  id: PresetId;
  answers: PresetAnswers;
  /** An open card's answer that suits this person, offered first on the card. */
  leaning: Readonly<Record<string, string>>;
}

/**
 * Steps every life passes the same way, never a card of its own: the opening draw, the university (federal is
 * open to everyone), the strike's drag, the results and the settlement; and the steps the short door passes
 * without a card (R-PROLOGUE-010): the exam studied for, a retake taken again, a strike waited
 * out, and the family house to sleep in.
 */
export const PRESET_THROUGH: PresetAnswers = {
  draw: ["begin"],
  university: ["federal"],
  "strike-drag": ["back"],
  graduation: ["results-nurse", "results"],
  settlement: ["settle"],
  // The age cards: the youngest year open, the age the path reaches, unless the front door set one (`agedAnswers`, R-PROLOGUE-009).
  ...Object.fromEntries(AGE_CARDS.map((card) => [card, cardYears(card)])),
  exam: ["study"],
  retake: ["again"],
  strike: ["wait"],
  home: ["family-house"],
};

/** `friend`: the crowd at the send-off, the answers in order, the first that is open taken (the table's preset). */
const degree = (subjects: string, course: string, side: string, hustle: string, friend: readonly string[]): PresetAnswers => ({
  ...PRESET_THROUGH,
  subjects: [subjects],
  "after-school": ["jamb"],
  course: [course],
  "side-skill": [side],
  hustle: [hustle],
  service: ["serve"],
  friend,
});

/*
 * The table names no subjects for the trader and the shop worker, and leaves the subjects card
 * out of their open cards. Commercial suits them, and it closes no door: the master is open after it to
 * exactly the children it is open to after science (a town child of parents without schooling, or a
 * family under 40).
 */
export const PRESETS: readonly Preset[] = [
  {
    id: "developer",
    // Focus in the final year keeps the grade at the master's and the bank's bar; code stays the side skill.
    answers: degree("science", "computer-science", "code", "focus", ["tech", "uk"]),
    leaning: { friend: "tech" },
  },
  { id: "nurse", answers: degree("science", "nursing", "books", "focus", ["care", "uk"]), leaning: { friend: "care" } },
  { id: "accountant", answers: degree("commercial", "accounting", "trade", "campus-shop", ["canada"]), leaning: { friend: "canada" } },
  { id: "writer", answers: degree("arts", "mass-comm", "content", "focus", ["uk"]), leaning: { friend: "uk" } },
  {
    id: "trader",
    answers: { ...PRESET_THROUGH, subjects: ["commercial"], "after-school": ["apprentice"], master: ["spare-parts"], years: ["stay"], friend: ["drivers"] },
    leaning: { friend: "drivers" },
  },
  {
    id: "shop-worker",
    // The drivers at the send-off, as the trader's: they talk of the Gulf.
    answers: { ...PRESET_THROUGH, subjects: ["commercial"], "after-school": ["work"], shop: ["save"], friend: ["drivers"] },
    leaning: { friend: "drivers" },
  },
  {
    // The child of the water (R-PROLOGUE-012): school by canoe, then the counter and the racks, no master and no
    // settlement, and a room on the lagoon at the start, with the family house still there to go back to.
    id: "water",
    answers: { ...PRESET_THROUGH, subjects: ["commercial"], "after-school": ["work"], shop: ["save"], friend: ["drivers"], home: ["makoko"] },
    leaning: { friend: "drivers" },
  },
];

/** The preset of a tile by its id, or null for an id no tile has. */
export function presetOf(id: string | null | undefined): Preset | null {
  return PRESETS.find((preset) => preset.id === id) ?? null;
}

/** The card's answers with the one that suits the tile first; the others keep their order. */
export function suitingFirst<A extends { id: string }>(preset: Pick<Preset, "answers" | "leaning"> | null, step: string, answers: readonly A[]): A[] {
  const first = preset === null ? undefined : (preset.leaning[step] ?? preset.answers[step]?.[0]);
  return [...answers].sort((a, b) => Number(b.id === first) - Number(a.id === first));
}

/** The preset's own answer at this card while one of them is allowed, else null: a draw has shut them (R-PROLOGUE-010). */
export function presetOwnAnswer(answers: PresetAnswers, step: string, open: readonly { id: string; allowed: boolean }[]): string | null {
  const wanted = answers[step] ?? [];
  return wanted.find((id) => open.some((answer) => answer.id === id && answer.allowed)) ?? null;
}

/**
 * The answer a new life sends at this card (R-PROLOGUE-010): the preset's, else the open answer
 * that suits the tile, else the first open one. Null only when every answer is shut.
 */
export function answerOf(preset: Pick<Preset, "answers" | "leaning">, step: string, open: readonly { id: string; allowed: boolean }[]): string | null {
  return presetOwnAnswer(preset.answers, step, open) ?? suitingFirst(preset, step, open).find((answer) => answer.allowed)?.id ?? null;
}

/** The outcome of a draw that is no setback (R-PROLOGUE-004): the first that leads neither to a retake nor to a strike. */
function plainOutcome(step: PrologueStep, answer: PrologueStep["answers"][number]): string | null {
  const outcomes = answer.draw ?? [];
  const plain = outcomes.find((outcome) => !["retake", "strike-drag"].includes(outcome.next ?? ""));
  return plain?.next ?? answer.next ?? step.next;
}

/**
 * The year a tile's life starts at with no step on the door (R-PROLOGUE-004, decision 0023): its cards answered as the
 * tile answers them, each draw with no setback, up to its age card, and the youngest year that card opens there: the age
 * its path reaches with no setback, the age the tile says.
 */
export function lowestYear(answers: PresetAnswers): number {
  let months = tuning.prologue.startAgeMonths;
  let at: string | null = "draw";
  for (let guard = 0; guard < 40 && at !== null; guard += 1) {
    const step: PrologueStep | undefined = prologueTable[at];
    if (step === undefined) break;
    if (AGE_CARDS.includes(at)) {
      const open = step.answers.find((answer) => answer.requires.every((requirement) => requirement.type !== "quality/max" || requirement.quality !== AGE || months <= requirement.value));
      return startYearOf(open?.id ?? "") ?? int.divFloor(months, YEAR);
    }
    const all = step.answers.map((answer) => ({ id: answer.id, allowed: true }));
    const id = presetOwnAnswer(answers, at, all) ?? step.answers[0]?.id;
    const answer = step.answers.find((one) => one.id === id) ?? step.answers[0];
    if (answer === undefined) break;
    months += step.months;
    at = plainOutcome(step, answer);
  }
  return int.divFloor(months, YEAR);
}

/**
 * The answers with the age the front door set (R-PROLOGUE-009, decision 0023): `years` older than the year the path
 * reaches, sent as that year on whichever age card the life comes to; a year shut there gives way to the nearest open
 * one above, then below.
 */
export function agedAnswers(answers: PresetAnswers, years: number): PresetAnswers {
  const year = lowestYear(answers) + Math.max(0, years);
  const order = (card: string): string[] => {
    const all = cardYears(card);
    const above = all.filter((id) => (startYearOf(id) ?? 0) >= year);
    const below = all.filter((id) => (startYearOf(id) ?? 0) < year).reverse();
    return [...above, ...below];
  };
  return { ...answers, ...Object.fromEntries(AGE_CARDS.map((card) => [card, order(card)])) };
}

/**
 * The homes the door can start a life in (R-PROLOGUE-013): the home step's answers, the four homes of R-HOME-001, in the
 * order the door offers them (decision 0040): your own room first, the hostel second, the family house last, as the
 * one more reason to leave; Makoko for the child of the water alone.
 */
export const HOMES = ["compound-room", "hostel-room", "family-house", "makoko"] as const;
export type Home = (typeof HOMES)[number];

/** The home a tile starts in unless the player picks another: its own preset's, else the family house. */
export function presetHome(answers: PresetAnswers): Home {
  const own = answers["home"]?.[0];
  return HOMES.find((home) => home === own) ?? "family-house";
}

/** The homes the door offers a tile (R-PROLOGUE-013): the compound room, the hostel room and the family house to every tile, Makoko to the child of the water alone. */
export function presetHomes(answers: PresetAnswers): Home[] {
  return HOMES.filter((home) => home !== "makoko" || presetHome(answers) === "makoko");
}

/** The answers with the home picked on the door as the home step's (R-PROLOGUE-010, 013); a home the door has not is ignored. */
export function homedAnswers(answers: PresetAnswers, home: string | null | undefined): PresetAnswers {
  const picked = HOMES.find((one) => one === home);
  return picked === undefined ? answers : { ...answers, home: [picked] };
}

/** The steps older than its own a tile's age may be set on the door (R-PROLOGUE-009), its own first: up to three, never past the oldest start. */
export function presetAges(answers: PresetAnswers): number[] {
  const most = Math.max(0, Math.min(PRESET_STEPS_OLDER, OLDEST - lowestYear(answers)));
  return Array.from({ length: most + 1 }, (_, at) => at);
}

/** True when the door offers this tile, this age step and this home (server.md R-SERVER-046: anything else is refused). */
export function presetOffered(archetype: string, age: number, home: string): boolean {
  const preset = presetOf(archetype);
  if (preset === null) return false;
  return presetAges(preset.answers).includes(age) && (presetHomes(preset.answers) as readonly string[]).includes(home);
}

/**
 * The answer a new life sends at `step` (prologue.md R-PROLOGUE-010, server.md R-SERVER-046): the tile's preset with the
 * door's age step (`age`, years older than the tile's own) and home, the preset's answer where it is allowed, else the
 * open answer that suits the tile. Null for an id no tile has, or when every answer at the step is shut. The one
 * function the client plays offline and the server plays online.
 */
export function presetAnswer(archetype: string, age: number, home: string, step: string, answers: readonly { id: string; allowed: boolean }[]): string | null {
  const preset = presetOf(archetype);
  if (preset === null) return null;
  return answerOf({ answers: homedAnswers(agedAnswers(preset.answers, age), home), leaning: preset.leaning }, step, answers);
}
