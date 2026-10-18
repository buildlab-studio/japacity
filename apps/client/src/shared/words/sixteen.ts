// The life from sixteen after its handover. The view keeps no prologue once it
// closes (prologue:closing-opens-home-charges), so the path it built is read from the life as it stands: a degree from the
// level of schooling, a shop's capital from the money a trade could only hold after a settlement, or the
// shop it opened with it.
import { content } from "@japacity/content";
import { FIRST_MEETUP_FITS, type Id, type PlayerView, qualityIn, type Requirement } from "@japacity/sim";

import { hasWords } from "./text";

/** `degree`: through university. `capital`: a trade with the master's settlement. `trade`: a trade or a shop counter without it. */
export type SixteenPath = "degree" | "capital" | "trade";

type Life = Pick<PlayerView, "scenario" | "qualities" | "pockets"> & Partial<Pick<PlayerView, "job">>;
/** The papers and the routes, which say a nurse and a way already heard of. A caller without them gets the chapter's order. */
type Held = Partial<Pick<PlayerView, "documents" | "routes">>;

const EDU_LEVEL = "quality.edu-level";
const GRADE = "quality.edu-grade";
const CARE = "quality.care";
/** A bachelor's degree (quality.md), the level the degree path closes at. */
const DEGREE = 3;
/** The act that opens a trader's own shop, and the shop it opens. */
const OPEN_SHOP = "activity.open-shop" as Id<"activity">;
const SHOP = "activity.run-shop";
const FIRST_CHAPTER = "chapter.find-your-feet";
/** A trader with capital has money to move with, so hearing of a way out and reading up on it come before the jobs board. */
const CAPITAL_FIRST = ["heard", "known"];
/** A trade without a degree hears of a way out first and looks it into next, both at the motor park (decision 0001). */
const TRADE_FIRST = ["heard", "known"];
/** A nurse is care 30 or more with the licence (prologue.md, the graduation step), as the prologue's own results say. */
const NURSE_CARE = 30;
const LICENCE = "document.nursing-licence";
const NURSE_JOB = "activity.job-nurse" as Id<"activity">;
const GULF = "route.gulf-contract";
const MASTERS = "route.uk-masters";

/**
 * A shop's capital: the naira the shop's act asks to have in hand, from content. It sits under the fair settlement,
 * so the living costs of the first months leave a trader a trader, and over what a trade
 * holds without one.
 */
function shopCapital(): number {
  const needs = content.activity[OPEN_SHOP]?.requires.find((requirement): requirement is Extract<Requirement, { type: "money/min" }> => requirement.type === "money/min" && requirement.currency === "NGN");
  if (needs === undefined || typeof needs.amount !== "number") throw new Error("The shop's act asks for no capital in naira.");
  return needs.amount;
}


/** The path a life from sixteen took, read at its handover and in its first months; null for a fixed life. */
export function sixteenPath(life: Life): SixteenPath | null {
  if (content.scenario[life.scenario]?.prologue !== true) return null;
  if (qualityIn(life, EDU_LEVEL) >= DEGREE) return "degree";
  if (life.job?.id === SHOP) return "capital";
  // No trade path without a settlement earns near a shop's capital: the shop counter holds at most ₦500,000.
  return life.pockets.NGN.bank + life.pockets.NGN.cash >= shopCapital() ? "capital" : "trade";
}

/** A nurse from sixteen: the nursing course's care and the licence its graduation grants. */
export function sixteenNurse(life: Life & Held): boolean {
  return sixteenPath(life) === "degree" && qualityIn(life, CARE) >= NURSE_CARE && (life.documents ?? []).some((paper) => paper.id === LICENCE && paper.state === "held");
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
  key: "clinic" | "motor-park" | "shop";
  place: Id<"place">;
  /** The thing in the place's file that offers it. */
  thing: string;
  activity: Id<"activity">;
}

/** The nurse's first step: the staff nurse's job, staged at the clinic. */
const CLINIC_WAY: OwnWay = { step: "job", key: "clinic", place: "place.tb-clinic", thing: "jobs-notice", activity: NURSE_JOB };
/** A trade's first step: asking around at the motor park in Ojuelegba, where the Gulf is heard. */
const MOTOR_PARK_WAY: OwnWay = { step: "heard", key: "motor-park", place: "place.ojuelegba", thing: "motor-park", activity: "activity.ask-around" };
/** A trade that heard of the Gulf (from the drivers at the send-off) looks it into by asking around at the same park (chapter:chapters-follow-lean-route's reading; decision 0001). */
const MOTOR_PARK_LOOK: OwnWay = { ...MOTOR_PARK_WAY, step: "known" };

/** A trader's job: her own shop, opened at her stall in the market with the settlement. */
const SHOP_WAY: OwnWay = { step: "job", key: "shop", place: "place.tejuosho-market", thing: "own-stall", activity: OPEN_SHOP };

function routeState(view: Held, route: string): string {
  return view.routes?.find((one) => one.id === route)?.state ?? "unknown";
}

/**
 * The life's own way to its next step in the first chapter, or null when the chapter's table says it: a nurse
 * with no job goes to the clinic for the staff nurse's job, a trade that has heard of no way out asks
 * around at the motor park until the Gulf is heard, and asks around there again to look it into (decision 0001),
 * and a trader with a shop's capital opens her own shop.
 */
export function ownWayOf(view: Life & Pick<PlayerView, "chapter"> & Partial<Pick<PlayerView, "job">> & Held): OwnWay | null {
  if (view.chapter.current !== FIRST_CHAPTER) return null;
  const step = nextStepOf(view);
  if (step === CLINIC_WAY.step && sixteenNurse(view) && view.job?.id !== NURSE_JOB) return CLINIC_WAY;
  const path = sixteenPath(view);
  if (step === MOTOR_PARK_WAY.step && (path === "trade" || path === "capital") && view.routes !== undefined && routeState(view, GULF) === "unknown") return MOTOR_PARK_WAY;
  if (step === MOTOR_PARK_LOOK.step && (path === "trade" || path === "capital") && view.routes !== undefined && routeState(view, GULF) === "heard") return MOTOR_PARK_LOOK;
  if (step === SHOP_WAY.step && path === "capital" && view.job?.id !== SHOP) return SHOP_WAY;
  return null;
}

/**
 * The first chapter's words in the life's own voice: `<key>.<path>` for a life from sixteen
 * when content has words for its path (a trader with the settlement opens her shop), else the key.
 */
export function ownWords(view: Life & Pick<PlayerView, "chapter">, key: string, has: (key: string) => boolean = hasWords): string {
  if (view.chapter.current !== FIRST_CHAPTER || !key.startsWith(`${FIRST_CHAPTER}.`)) return key;
  const path = sixteenPath(view);
  return path !== null && has(`${key}.${path}`) ? `${key}.${path}` : key;
}

/**
 * The current chapter's opening words for this life (world:world-fills-the-screen): the scenario's own
 * line when content has one, the prologue's by its path (a degree, a trade, a trade with the settlement), else the
 * chapter's line, so a trader's chapter never opens on the service year.
 */
export function openingKey(view: Life & Pick<PlayerView, "chapter">, has: (key: string) => boolean = hasWords): string {
  const chapter = view.chapter.current ?? "";
  const slug = view.scenario.replace(/^scenario\./, "");
  const own = slug === "prologue" ? `${chapter}.open.prologue.${sixteenPath(view) ?? "trade"}` : `${chapter}.open.${slug}`;
  return has(own) ? own : `${chapter}.open`;
}

/**
 * The way out a life's own profile fits, once heard of: a trade's is the Gulf (the motor park), and a degree's is the
 * first of the first meetup's fits whose bar it clears (guide:first-meetup-hears-fitting-route: care work for a nurse, the talent visa for a developer).
 * Null for a life whose way is the master's, the chapters' default, or whose own way is not yet heard of.
 */
export function ownRouteOf(view: Life & Held): Id<"route"> | null {
  const path = sixteenPath(view);
  const own = path === "trade" || path === "capital" ? (GULF as Id<"route">) : (FIRST_MEETUP_FITS.find((fit) => fit.bar !== null && fit.bar.type === "quality/min" && qualityIn(view, fit.bar.quality) >= fit.bar.value)?.route ?? null);
  if (own === null || own === MASTERS) return null;
  return routeState(view, own) === "unknown" ? null : own;
}

const CARE_WORK = "route.uk-care";
const TENURE = "tenure";

/**
 * The months on the ward a chapter counts, and how many it needs (the care file's council rule, route-gates:care-route-needs-verification), from the
 * chapter's own item; null for a chapter that counts none (Japa and the nudge count them).
 */
export function wardMonths(view: Pick<PlayerView, "chapter"> & Partial<Pick<PlayerView, "job">>): { done: number; need: number } | null {
  const requirement = view.chapter.current === null ? undefined : content.chapter[view.chapter.current]?.items.find((item) => item.id === TENURE)?.requirement;
  if (requirement?.type !== "activity/tenure") return null;
  const months = view.job?.id !== null && view.job?.id !== undefined && requirement.activities.includes(view.job.id) ? view.job.months : 0;
  return { done: Math.min(months, requirement.months), need: requirement.months };
}

/**
 * The stops a life reaches before its chapter opens them: the nurse's clinic, where her job is,
 * and for any life whose plan is care work, or whose chapter is the care file's, the clinic where the council, the
 * certification and the TB test are.
 */
export function earlyStops(life: Life & Held & Partial<Pick<PlayerView, "plan" | "chapter">>): string[] {
  const careFile = life.plan?.route === CARE_WORK || (life.chapter?.current !== null && life.chapter?.current !== undefined && content.chapter[life.chapter.current]?.route === CARE_WORK);
  return sixteenNurse(life) || careFile ? [CLINIC_WAY.place] : [];
}

/** The fish racks at Makoko, the child of the water's work at hand (activity:fish-racks-at-makoko). */
export const RACKS = "activity.job-fish-racks";
/** The first chapter's words for the racks: the band's nudge and the handover's first step say the same. */
export const RACKS_STEP = `${FIRST_CHAPTER}.item.job.nudge.racks`;

/**
 * The racks are the work at hand (activity:fish-racks-at-makoko): the first chapter, no job held, its job step undone and the racks on
 * the board, as they are for a life in Makoko's room. Then the racks come before the life's own way out, at the
 * handover as on the band, and the motor park comes after.
 */
export function racksAtHand(view: Pick<PlayerView, "chapter"> & Partial<Pick<PlayerView, "job" | "activities">>): boolean {
  return (
    view.chapter.current === FIRST_CHAPTER &&
    (view.job?.id ?? null) === null &&
    view.chapter.items.some((item) => item.id === "job" && !item.met) &&
    (view.activities?.find((option) => option.id === "activity.job-hunt")?.params ?? []).includes(RACKS)
  );
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
  return sixteenPath(life) === "degree" && qualityIn(life, GRADE) < gradeBar();
}
