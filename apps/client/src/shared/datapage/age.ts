// The age in steps (prologue.md R-PROLOGUE-009, the review): never typed. The tile's own age is the middle
// and the player steps it a few years either side, inside 18 to 29. The steps are the prologue's age card in content,
// whose answers carry the effects; the client only reads them, sends the one picked through the tile's preset, and
// says what each does.
import { content } from "@japacity/content";
import type { Effect, Id, PrologueStep, Requirement } from "@japacity/sim";

import { formatMoney } from "../words/format";
import { say, sayCount } from "../words/text";

/** The prologue's age card. */
export const AGE_CARD = "age";
const AGE = "quality.age-months";
const PASSPORT = "document.passport";
const YEAR = 12;
const CANADA = "points.canada" as Id<"points">;

type Answer = PrologueStep["answers"][number];

export interface AgeStep {
  /** The card's answer. */
  answer: string;
  /** Years from the middle: negative is younger. */
  years: number;
  /** Naira in kobo the step brings. */
  saved: number;
  /** True when the step brings the passport held. */
  passport: boolean;
  requires: readonly Requirement[];
}

function card(): PrologueStep {
  const entry = content.prologue[AGE_CARD];
  if (entry === undefined) throw new Error("The content has no age card.");
  return entry;
}

function stepOf(answer: Answer): AgeStep {
  const ages = answer.effects.filter((effect): effect is Extract<Effect, { type: "quality/add" }> => effect.type === "quality/add" && effect.quality === AGE);
  const months = ages.reduce((sum, effect) => sum + (typeof effect.amount === "number" ? effect.amount : 0), 0);
  const saved = answer.effects.reduce((sum, effect) => sum + (effect.type === "money/add" && effect.currency === "NGN" && typeof effect.amount === "number" ? effect.amount : 0), 0);
  const passport = answer.effects.some((effect) => effect.type === "document/grant" && effect.document === PASSPORT);
  return { answer: answer.id, years: Math.trunc(months / YEAR), saved, passport, requires: answer.requires };
}

/** Every step the card offers, youngest first. */
export function ageSteps(): AgeStep[] {
  return card()
    .answers.map(stepOf)
    .sort((a, b) => a.years - b.years);
}

/** The card's limit of one kind, as the age a start lands at: a step's requirement plus the years it moves. */
function bound(kind: "quality/min" | "quality/max"): number {
  const limits = ageSteps().flatMap((step) => step.requires.flatMap((requirement) => (requirement.type === kind && requirement.quality === AGE && typeof requirement.value === "number" ? [requirement.value + step.years * YEAR] : [])));
  if (limits.length === 0) throw new Error(`The age card has no ${kind}.`);
  return kind === "quality/min" ? Math.min(...limits) : Math.max(...limits);
}

/** The youngest and the oldest a start may be, in whole years, from the card's own limits. */
export const YOUNGEST = Math.floor(bound("quality/min") / YEAR);
export const OLDEST = Math.floor(bound("quality/max") / YEAR);

/** True when the step's requirements hold at this age in months. */
function holds(step: AgeStep, months: number): boolean {
  return step.requires.every((requirement) => {
    if (requirement.type === "quality/min" && requirement.quality === AGE && typeof requirement.value === "number") return months >= requirement.value;
    if (requirement.type === "quality/max" && requirement.quality === AGE && typeof requirement.value === "number") return months <= requirement.value;
    return true;
  });
}

/** The steps open at a card reached at this age, in years from it. */
export function stepsOpen(months: number): number[] {
  return ageSteps()
    .filter((step) => holds(step, months))
    .map((step) => step.years);
}

/** The age from which Canada's points for age start to fall, from its own table: the young-favouring limit the page names. */
export function youngLimitYears(): number {
  const rows = content.points[CANADA]?.age ?? [];
  const most = Math.max(...rows.map((row) => row.points));
  const top = rows.findIndex((row) => row.points === most);
  return rows[top + 1]?.years ?? rows.at(-1)?.years ?? 0;
}

/** What a step does, for the page: the saving and the passport for older, the years before Canada's age points fall otherwise. */
export function ageStepWords(years: number, middle: number): string {
  const step = ageSteps().find((one) => one.years === years);
  if (step !== undefined && step.years > 0) return say(step.passport ? "prologue.age.older.passport" : "prologue.age.older", { amount: formatMoney(step.saved, "NGN") });
  const left = Math.max(0, youngLimitYears() - Math.floor((middle + years * YEAR) / YEAR));
  return sayCount(years === 0 ? "prologue.age.as-is" : "prologue.age.younger", left, { count: left });
}
