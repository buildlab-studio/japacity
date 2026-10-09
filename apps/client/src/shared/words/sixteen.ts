// The life from sixteen after its handover. The view keeps no prologue once it
// closes (R-PROLOGUE-006), so the path it built is read from the life as it stands: a degree from the
// level of schooling, a shop's capital from the money a trade could only hold after a settlement.
import { content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";

/** `degree`: through university. `capital`: a trade with the master's settlement. `trade`: a trade or a shop counter without it. */
export type SixteenPath = "degree" | "capital" | "trade";

type Life = Pick<PlayerView, "scenario" | "qualities" | "pockets">;
/** The papers and the routes, which say a nurse and a way already heard of. A caller without them gets the chapter's order. */
type Held = Partial<Pick<PlayerView, "documents" | "routes">>;

const EDU_LEVEL = "quality.edu-level";
const GRADE = "quality.edu-grade";
const CARE = "quality.care";
/** A bachelor's degree (quality.md), the level the degree path closes at. */
const DEGREE = 3;
/** The settlement that is still a shop's capital: the fair one, "enough to start small". The cheated one is not. */
const LEAST_CAPITAL = "fair";
const FIRST_CHAPTER = "chapter.find-your-feet";
/** A trader with capital has money to move with, so hearing of a way out and reading up on it come before the jobs board. */
const CAPITAL_FIRST = ["heard", "known"];
/** A trade without a degree hears of a way out first, at the motor park. */
const TRADE_FIRST = ["heard"];
/** A nurse is care 30 or more with the licence (prologue.md, the graduation step), as the prologue's own results say. */
const NURSE_CARE = 30;
const LICENCE = "document.nursing-licence";
const NURSE_JOB = "activity.job-nurse" as Id<"activity">;
const GULF = "route.gulf-contract";
const MASTERS = "route.uk-masters";

/** The fair settlement's sum, from content's own draw. */
function leastCapital(): number {
  const outcomes = (content.prologue.settlement?.answers ?? []).flatMap((answer) => answer.draw ?? []);
  const fair = outcomes.find((outcome) => outcome.id === LEAST_CAPITAL);
  for (const effect of fair?.effects ?? []) {
    if (effect.type === "money/add" && effect.currency === "NGN" && typeof effect.amount === "number") return effect.amount;
  }
  throw new Error("The prologue's settlement has no fair outcome with money.");
}

function qualityOf(life: Pick<PlayerView, "qualities">, id: string): number {
  return life.qualities.find((quality) => quality.id === id)?.value ?? 0;
}

/** The path a life from sixteen took, read at its handover and in its first months; null for a fixed life. */
export function sixteenPath(life: Life): SixteenPath | null {
  if (content.scenario[life.scenario]?.prologue !== true) return null;
  if (qualityOf(life, EDU_LEVEL) >= DEGREE) return "degree";
  // No trade path without a settlement earns near the fair settlement: the shop counter holds at most ₦500,000.
  return life.pockets.NGN.bank + life.pockets.NGN.cash >= leastCapital() ? "capital" : "trade";
}

/** A nurse from sixteen: the nursing course's care and the licence its graduation grants. */
export function sixteenNurse(life: Life & Held): boolean {
  return sixteenPath(life) === "degree" && qualityOf(life, CARE) >= NURSE_CARE && (life.documents ?? []).some((paper) => paper.id === LICENCE && paper.state === "held");
}

/** The chapter's next undone step for this life: a trade hears of a way out first, and a trader with capital reads up on it next. */
export function nextStepOf(view: Life & Pick<PlayerView, "chapter">): string | null {
  const undone = view.chapter.items.filter((item) => !item.met).map((item) => item.id);
  const path = view.chapter.current === FIRST_CHAPTER ? sixteenPath(view) : null;
  const order = path === "capital" ? CAPITAL_FIRST : path === "trade" ? TRADE_FIRST : [];
  return order.find((id) => undone.includes(id)) ?? undone[0] ?? null;
}

/** Where a life's own first step is taken, when its archetype has a place for it that the chapter's table does not name. */
export interface OwnWay {
  /** The chapter's step it takes. */
  step: string;
  /** The words' key: `prologue.handover.step.<step>.<key>`. */
  key: "clinic" | "motor-park";
  place: Id<"place">;
  /** The thing in the place's file that offers it. */
  thing: string;
  activity: Id<"activity">;
}

/** The nurse's first step: the staff nurse's job, staged at the clinic. */
const CLINIC_WAY: OwnWay = { step: "job", key: "clinic", place: "place.tb-clinic" as Id<"place">, thing: "jobs-notice", activity: NURSE_JOB };
/** A trade's first step: asking around at the motor park in Ojuelegba, where the Gulf is heard. */
const MOTOR_PARK_WAY: OwnWay = { step: "heard", key: "motor-park", place: "place.ojuelegba" as Id<"place">, thing: "motor-park", activity: "activity.ask-around" as Id<"activity"> };

function routeState(view: Held, route: string): string {
  return view.routes?.find((one) => one.id === route)?.state ?? "unknown";
}

/**
 * The life's own way to its next step in the first chapter, or null when the chapter's table says it: a nurse
 * with no job goes to the clinic for the staff nurse's job, and a trade that has heard of no way out asks
 * around at the motor park until the Gulf is heard.
 */
export function ownWayOf(view: Life & Pick<PlayerView, "chapter"> & Partial<Pick<PlayerView, "job">> & Held): OwnWay | null {
  if (view.chapter.current !== FIRST_CHAPTER) return null;
  const step = nextStepOf(view);
  if (step === CLINIC_WAY.step && sixteenNurse(view) && view.job?.id !== NURSE_JOB) return CLINIC_WAY;
  const path = sixteenPath(view);
  if (step === MOTOR_PARK_WAY.step && (path === "trade" || path === "capital") && view.routes !== undefined && routeState(view, GULF) === "unknown") return MOTOR_PARK_WAY;
  return null;
}

/** The stops a life reaches before its chapter opens them: the nurse's clinic, where her job is. */
export function earlyStops(life: Life & Held): string[] {
  return sixteenNurse(life) ? [CLINIC_WAY.place] : [];
}

/** The master's own bar on the degree's grade (route.md: second class lower), from content. */
function gradeBar(): number {
  for (const item of content.route[MASTERS]?.checklist ?? []) {
    const requirement = item.requirement;
    if (requirement.type === "quality/min" && requirement.quality === GRADE) return requirement.value;
  }
  throw new Error("The master's has no bar on the grade.");
}

/** A degree whose grade is under the master's and the bank's bar. */
export function gradeShort(life: Life): boolean {
  return sixteenPath(life) === "degree" && qualityOf(life, GRADE) < gradeBar();
}
