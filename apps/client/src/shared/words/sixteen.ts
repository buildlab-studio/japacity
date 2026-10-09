// The life from sixteen after its handover. The view keeps no prologue once it
// closes (R-PROLOGUE-006), so the path it built is read from the life as it stands: a degree from the
// level of schooling, a shop's capital from the money a trade could only hold after a settlement.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";

/** `degree`: through university. `capital`: a trade with the master's settlement. `trade`: a trade or a shop counter without it. */
export type SixteenPath = "degree" | "capital" | "trade";

type Life = Pick<PlayerView, "scenario" | "qualities" | "pockets">;

const EDU_LEVEL = "quality.edu-level";
/** A bachelor's degree (quality.md), the level the degree path closes at. */
const DEGREE = 3;
/** The settlement that is still a shop's capital: the fair one, "enough to start small". The cheated one is not. */
const LEAST_CAPITAL = "fair";
const FIRST_CHAPTER = "chapter.find-your-feet";
/** A trader with capital has money to move with, so hearing of a way out and reading up on it come before the jobs board. */
const CAPITAL_FIRST = ["heard", "known"];

/** The fair settlement's sum, from content's own draw. */
function leastCapital(): number {
  const outcomes = (content.prologue.settlement?.answers ?? []).flatMap((answer) => answer.draw ?? []);
  const fair = outcomes.find((outcome) => outcome.id === LEAST_CAPITAL);
  for (const effect of fair?.effects ?? []) {
    if (effect.type === "money/add" && effect.currency === "NGN" && typeof effect.amount === "number") return effect.amount;
  }
  throw new Error("The prologue's settlement has no fair outcome with money.");
}

/** The path a life from sixteen took, read at its handover and in its first months; null for a fixed life. */
export function sixteenPath(life: Life): SixteenPath | null {
  if (content.scenario[life.scenario]?.prologue !== true) return null;
  const level = life.qualities.find((quality) => quality.id === EDU_LEVEL)?.value ?? 0;
  if (level >= DEGREE) return "degree";
  // No trade path without a settlement earns near the fair settlement: the shop counter holds at most ₦500,000.
  return life.pockets.NGN.bank + life.pockets.NGN.cash >= leastCapital() ? "capital" : "trade";
}

/** The chapter's next undone step for this life: a trader with capital goes to the meetup and the official page first. */
export function nextStepOf(view: Life & Pick<PlayerView, "chapter">): string | null {
  const undone = view.chapter.items.filter((item) => !item.met).map((item) => item.id);
  const first = view.chapter.current === FIRST_CHAPTER && sixteenPath(view) === "capital" ? CAPITAL_FIRST.find((id) => undone.includes(id)) : undefined;
  return first ?? undone[0] ?? null;
}
