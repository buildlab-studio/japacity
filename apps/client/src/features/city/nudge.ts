// The nudge line's choice (docs/rules/world.md R-WORLD-003): one thing to notice, from the view, in
// this order: an open set piece or interview question; an open offer; the chapter's next undone step
// in its own nudge words; a report line waiting on the player; else the month's end.
import { content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";

import { duesGap } from "../../shared/words/dues";
import { formatMoney } from "../../shared/words/format";
import { asksAttention, tidyLines } from "../../shared/words/lines";
import { nextStepOf, ownRouteOf, ownWayOf, RACKS, RACKS_STEP, racksAtHand, wardMonths } from "../../shared/words/sixteen";
import { routeKeptBy } from "../../shared/words/keepJob";
import { hasWords, inMonths, nameOf, say } from "../../shared/words/text";
import type { Nudge } from "../../shared/world/contract";

/** What the nudge points at, so a tap on it can open the matching sheet. `dues`: the month's dues abroad pass the money held; it opens the Bank. */
export type NudgeAbout = "setpiece" | "offer" | "step" | "report" | "dues" | "goal" | "end";

/**
 * Where a chapter's step is done (R-WORLD-003): the things that move it, as `<place>:<thing>` in
 * the order to prefer when more than one stands in the place, and the stop to ride to when none
 * does. `go` null: the step is done by ending the month.
 */
export interface StepWay {
  go: string | null;
  at: readonly string[];
  /** The step's own card, opened straight from its thing here instead of the thing's list. */
  opens?: string;
  /** The choice that card opens with: the life's own route on the official page (first). */
  param?: string;
}

const HUB_DESK: StepWay = { go: "place.yaba", at: ["place.yaba:desk", "place.ojuelegba:hub"] };
const PAPERS: StepWay = { go: "place.family-house", at: ["place.family-house:papers-box", "place.family-house:house"] };
const MONTH_END: StepWay = { go: null, at: [] };
const FIRST_CHAPTER = "chapter.find-your-feet";
const OFFICIAL_PAGE = "activity.look-into-route";

/** A route's name after "the page on": its first letter lowered. */
function lowerFirst(words: string): string {
  return words.charAt(0).toLowerCase() + words.slice(1);
}
const CLINIC_DESK: StepWay = { go: "place.tb-clinic", at: ["place.tb-clinic:desk"] };
const CLINIC_NOTICE: StepWay = { go: "place.tb-clinic", at: ["place.tb-clinic:jobs-notice"] };
/** The council's acts at the clinic's notice, each opened straight from it. */
const COUNCIL_VERIFICATION: StepWay = { ...CLINIC_NOTICE, opens: "activity.request-verification" };
const COUNCIL_LICENCE: StepWay = { ...CLINIC_NOTICE, opens: "activity.renew-licence" };
const VISA_DESK: StepWay = { go: "place.visa-centre", at: ["place.visa-centre:desk"] };
const POLICE_NOTICE: StepWay = { go: "place.visa-centre", at: ["place.visa-centre:police-notice"] };
const AGENT_DESK: StepWay = { go: "place.agent-office", at: ["place.agent-office:desk"] };

const STEP_WAYS: Record<string, StepWay> = {
  "chapter.find-your-feet.job": { go: "place.yaba", at: ["place.yaba:jobs", "place.ojuelegba:hub"] },
  "chapter.find-your-feet.pay": MONTH_END,
  "chapter.find-your-feet.heard": { go: "place.yaba", at: ["place.yaba:meetup", "place.ojuelegba:hub"] },
  "chapter.find-your-feet.known": HUB_DESK,
  "chapter.build-the-file.passport": PAPERS,
  "chapter.build-the-file.transcript": PAPERS,
  "chapter.build-the-file.english": { go: "place.english-test-centre", at: ["place.english-test-centre:desk"] },
  "chapter.build-the-file.offer": { ...HUB_DESK, opens: "activity.apply-to-school" },
  "chapter.decision-day.deposit": { go: "place.olokun-office", at: ["place.olokun-office:counter"] },
  "chapter.decision-day.held": MONTH_END,
  "chapter.decision-day.tb": CLINIC_DESK,
  "chapter.decision-day.applied": VISA_DESK,
  "chapter.decision-day.granted": MONTH_END,
  // R-CHAPTER-009: the file and decision day of each way out of the player's own effort.
  "chapter.build-the-file-care.tenure": MONTH_END,
  "chapter.build-the-file-care.verification": COUNCIL_VERIFICATION,
  "chapter.build-the-file-care.sponsor": HUB_DESK,
  // The care file's own detours, not items of the chapter (`careDetour`): the licence renewed, a sponsor at the bar, the window.
  "chapter.build-the-file-care.licence": COUNCIL_LICENCE,
  "chapter.build-the-file-care.salary": HUB_DESK,
  "chapter.build-the-file-care.window": MONTH_END,
  "chapter.build-the-file-care.applied": VISA_DESK,
  "chapter.build-the-file-talent.portfolio": HUB_DESK,
  "chapter.build-the-file-talent.endorsement": HUB_DESK,
  "chapter.build-the-file-talent.applied": VISA_DESK,
  "chapter.build-the-file-points.eca": PAPERS,
  "chapter.build-the-file-points.english": { go: "place.english-test-centre", at: ["place.english-test-centre:desk"] },
  "chapter.build-the-file-points.pool": HUB_DESK,
  "chapter.build-the-file-points.invited": MONTH_END,
  "chapter.build-the-file-gulf.passport": PAPERS,
  "chapter.build-the-file-gulf.medical": CLINIC_DESK,
  "chapter.build-the-file-gulf.agent": AGENT_DESK,
  "chapter.build-the-file-gulf.contract": AGENT_DESK,
  "chapter.decision-day-care.tb": CLINIC_DESK,
  "chapter.decision-day-care.police": POLICE_NOTICE,
  "chapter.decision-day-care.applied": VISA_DESK,
  "chapter.decision-day-care.granted": MONTH_END,
  "chapter.decision-day-talent.tb": CLINIC_DESK,
  "chapter.decision-day-talent.applied": VISA_DESK,
  "chapter.decision-day-talent.granted": MONTH_END,
  "chapter.decision-day-points.police": POLICE_NOTICE,
  "chapter.decision-day-points.applied": MONTH_END,
  "chapter.decision-day-points.granted": MONTH_END,
  "chapter.decision-day-gulf.police": POLICE_NOTICE,
  "chapter.decision-day-gulf.applied": AGENT_DESK,
  "chapter.decision-day-gulf.granted": MONTH_END,
  "chapter.send-off.departed": { go: "place.airport-lagos", at: ["place.airport-lagos:gate"] },
  // Abroad the nudge never opens the map (the map there is a list), so the steps are reached through `at`.
  "chapter.landing.room": { go: "place.the-room", at: ["place.the-room:post"] },
  "chapter.landing.job": { go: "place.peckham", at: ["place.peckham:jobs-notice", "place.peckham:agency", "place.deira:agency", "place.deira:site-bus"] },
  "chapter.landing.request": { go: "place.the-room", at: ["place.the-room:phone"] },
  "chapter.landing.file": MONTH_END,
  "chapter.landing.status": MONTH_END,
  "chapter.secure.secure": MONTH_END,
};

/** Where the money is when a step is short of it: the hub's jobs board. The funds step keeps its own way. */
export const BOARD_WAY: StepWay = { go: "place.yaba", at: ["place.yaba:jobs", "place.ojuelegba:hub"] };

/** The way to the chapter's next undone step, or null when the step has no place in the world (life abroad). */
export function stepWayOf(view: StepView & Partial<Pick<PlayerView, "obligations">>): StepWay | null {
  const step = stepOf(view);
  if (view.chapter.current === null || step === null) return null;
  // A life's own way to its first steps, where its archetype has one the table does not name.
  // While a life in Makoko's room has no job, the racks beside it come first (R-ACTIVITY-017).
  if (racksAtHand(view)) return RACKS_WAY;
  const own = ownWay(view);
  if (own !== null) return { go: own.place, at: [`${own.place}:${own.thing}`] };
  // The first chapter's "Look into it" reads the page of the life's own way out, so a nurse leans to care work and not to the master's she read of first (R-CHAPTER-009).
  const route = ownRoute(view);
  if (route !== null && view.chapter.current === FIRST_CHAPTER && step === "known") return { ...HUB_DESK, opens: OFFICIAL_PAGE, param: route };
  // The plane blocked by held funds: the way is the bank's counter that takes them back.
  if (view.chapter.current === "chapter.send-off" && step === "departed" && heldFundsOpen({ ...view, setpiece: null, interview: null, offers: [], report: null })) return HELD_FUNDS_WAY;
  // The care file's detour, where the nudge names one.
  const detour = careDetour(view, step);
  return STEP_WAYS[detour ?? `${view.chapter.current}.${step}`] ?? null;
}

/**
 * The stop the chapter's first undone step is taken at, from the tables, so the map never keeps shut the place the
 * nudge sends the player to (R-WORLD-015). Null when the step is the month's end.
 */
export function stepStopOf(chapter: Pick<PlayerView["chapter"], "current" | "items">): string | null {
  const step = chapter.items.find((item) => !item.met)?.id;
  return chapter.current === null || step === undefined ? null : (STEP_WAYS[`${chapter.current}.${step}`]?.go ?? null);
}

/** The fish racks beside the room in Makoko, else the board in town that lists them too (R-ACTIVITY-017). */
const RACKS_WAY: StepWay = { go: "place.makoko", at: ["place.makoko:racks", "place.yaba:jobs", "place.ojuelegba:hub"] };

/** Where held funds go back: the bank's counter (R-ROUTE-020). */
const HELD_FUNDS_WAY: StepWay = { go: "place.olokun-office", at: ["place.olokun-office:clerk"] };

type StepView = Pick<PlayerView, "chapter"> & Partial<Pick<PlayerView, "scenario" | "qualities" | "pockets" | "routes" | "documents" | "job" | "activities">>;

/** The chapter's next undone step: for a trader from sixteen with a shop's capital, the meetup and the page before the board. */
function stepOf(view: StepView): string | null {
  const { scenario, qualities, pockets } = view;
  if (scenario !== undefined && qualities !== undefined && pockets !== undefined) return nextStepOf({ chapter: view.chapter, scenario, qualities, pockets });
  return view.chapter.items.find((item) => !item.met)?.id ?? null;
}

/** The life's own way to a first step (the nurse's clinic, the trade's motor park), when the view carries enough to tell. */
function ownRoute(view: StepView): ReturnType<typeof ownRouteOf> {
  const { scenario, qualities, pockets } = view;
  if (scenario === undefined || qualities === undefined || pockets === undefined) return null;
  return ownRouteOf({ scenario, qualities, pockets, ...(view.routes === undefined ? {} : { routes: view.routes }) });
}

function ownWay(view: StepView): ReturnType<typeof ownWayOf> {
  const { scenario, qualities, pockets } = view;
  if (scenario === undefined || qualities === undefined || pockets === undefined) return null;
  return ownWayOf({ chapter: view.chapter, scenario, qualities, pockets, ...(view.routes === undefined ? {} : { routes: view.routes }), ...(view.documents === undefined ? {} : { documents: view.documents }), ...(view.job === undefined ? {} : { job: view.job }) });
}

/** The thing in `here` that the step's way names, the first of its order that stands among `things`. */
export function stepThingHere(way: StepWay, here: string | null, things: readonly { id: string }[]): string | null {
  for (const entry of way.at) {
    const [place, thing] = entry.split(":");
    if (place === here && things.some((candidate) => candidate.id === thing)) return thing ?? null;
  }
  return null;
}

/** The paper a step waits on, so a started step can name the wait (R-WORLD-003). */
const STEP_PAPER: Record<string, string> = {
  "chapter.build-the-file.passport": "document.passport",
  "chapter.build-the-file.transcript": "document.transcript",
  // The English result is a paper too: once sat, the nudge says when it comes.
  "chapter.build-the-file.english": "document.english-test",
  "chapter.decision-day.tb": "document.tb-certificate",
  // R-CHAPTER-009: the papers of the other files.
  "chapter.build-the-file-care.verification": "document.nmcn-verification",
  "chapter.build-the-file-care.licence": "document.nursing-licence",
  "chapter.build-the-file-talent.endorsement": "document.endorsement",
  "chapter.build-the-file-points.eca": "document.eca",
  "chapter.build-the-file-points.english": "document.english-test",
  "chapter.build-the-file-gulf.passport": "document.passport",
  "chapter.build-the-file-gulf.medical": "document.medical",
  "chapter.decision-day-care.tb": "document.tb-certificate",
  "chapter.decision-day-care.police": "document.police-certificate",
  "chapter.decision-day-talent.tb": "document.tb-certificate",
  "chapter.decision-day-points.police": "document.police-certificate",
  "chapter.decision-day-gulf.police": "document.police-certificate",
};

/**
 * A step whose route can refuse it and make the player wait before asking again (R-ENDORSE-002): the endorsement. While
 * the wait runs the step names when it opens again, never the act it shuts.
 */
const STEP_REFUSAL: Record<string, string> = {
  "chapter.build-the-file-talent.endorsement": "route.uk-talent",
};

/** The month a refused step can be asked for again, from the route's refusal in the view, or null when no wait runs. */
function refusalWait(view: NudgeView, stepKey: string): number | null {
  const route = STEP_REFUSAL[stepKey];
  const gate = route === undefined ? undefined : view.routes?.find((candidate) => candidate.id === route)?.gate;
  if (gate?.gate !== "endorsement" || gate.refusedMonth === null || gate.cooledFromMonth === null) return null;
  return gate.cooledFromMonth > (view.month ?? 0) ? gate.cooledFromMonth : null;
}

/** The route the chapters follow, for the school's answer and the funds (chapter.md). */
const STORY_ROUTE = "route.uk-masters";

/** The activity that does a step, so a step planned this month or short of money can say so. */
const STEP_ACTIVITY: Record<string, string> = {
  "chapter.find-your-feet.known": "activity.look-into-route",
  "chapter.find-your-feet.heard": "activity.meetup",
  "chapter.build-the-file.passport": "activity.get-passport",
  "chapter.build-the-file.transcript": "activity.get-transcript",
  "chapter.build-the-file.english": "activity.sit-english-test",
  "chapter.build-the-file.offer": "activity.apply-to-school",
  "chapter.decision-day.tb": "activity.tb-test",
  "chapter.decision-day.applied": "activity.apply-for-visa",
  "chapter.landing.job": "activity.job-hunt",
  // R-CHAPTER-009: the acts of the other files.
  "chapter.build-the-file-care.verification": "activity.request-verification",
  "chapter.build-the-file-care.sponsor": "activity.find-sponsor",
  "chapter.build-the-file-care.licence": "activity.renew-licence",
  "chapter.build-the-file-care.salary": "activity.find-sponsor",
  "chapter.build-the-file-care.applied": "activity.apply-uk-care",
  "chapter.build-the-file-talent.portfolio": "activity.build-portfolio",
  "chapter.build-the-file-talent.endorsement": "activity.apply-endorsement",
  "chapter.build-the-file-talent.applied": "activity.apply-uk-talent",
  "chapter.build-the-file-points.eca": "activity.get-eca",
  "chapter.build-the-file-points.english": "activity.sit-english-test",
  "chapter.build-the-file-points.pool": "activity.enter-pool",
  "chapter.build-the-file-gulf.passport": "activity.get-passport",
  "chapter.build-the-file-gulf.medical": "activity.gulf-medical",
  "chapter.build-the-file-gulf.contract": "activity.apply-gulf-contract",
  "chapter.decision-day-care.tb": "activity.tb-test",
  "chapter.decision-day-care.police": "activity.get-police-certificate",
  "chapter.decision-day-care.applied": "activity.apply-uk-care",
  "chapter.decision-day-talent.tb": "activity.tb-test",
  "chapter.decision-day-talent.applied": "activity.apply-uk-talent",
  "chapter.decision-day-points.police": "activity.get-police-certificate",
  "chapter.decision-day-gulf.police": "activity.get-police-certificate",
  "chapter.decision-day-gulf.applied": "activity.apply-gulf-contract",
};

/** Other activities that also take a step when planned: the adviser's visit looks into the route. */
const STEP_ACTIVITY_ALSO: Record<string, readonly string[]> = {
  "chapter.find-your-feet.known": ["activity.see-adviser"],
  // A trade hears of its way out at the motor park.
  "chapter.find-your-feet.heard": ["activity.ask-around"],
};

type NudgeView = Pick<PlayerView, "setpiece" | "interview" | "offers" | "chapter" | "report"> & Partial<Pick<PlayerView, "documents" | "routes" | "month" | "activities" | "pockets" | "place" | "obligations" | "job" | "scenario" | "qualities" | "goals">>;

/** The nudge that sends a waiting life to the board for better pay. */
export const BETTER_JOB = "ui.nudge.better-job";
/** Held funds still open block the plane. */
const HELD_FUNDS = "held-funds";

const NURSE_JOB = "activity.job-nurse";

/** The waiting months' acts by profile (R-ACTIVITY-013): the act a life with nothing else to do is pointed at, where it is offered and not yet planned. */
const MEANWHILE: readonly { act: string; fits: (view: NudgeView) => boolean }[] = [
  { act: "nurse-certification", fits: (view) => qualityOf(view, "quality.care") >= 50 && (view.documents ?? []).some((paper) => paper.id === "document.nursing-licence" && paper.state === "held") },
  { act: "open-source", fits: (view) => qualityOf(view, "quality.tech") >= 40 },
  { act: "tech-posts", fits: (view) => qualityOf(view, "quality.tech") >= 30 },
  // Not for the staff nurse: getting noticed counts toward the study visa and Canada's points, never care work, and her
  // ward is the clinic, never the hub's board. The act stays on the hub's board alone (R-CITY-010).
  { act: "be-noticed", fits: (view) => (view.job?.months ?? 0) >= 6 && view.job?.id !== NURSE_JOB },
];

/** Where each waiting-month act is taken (the m18 builders' stagings). */
export const MEANWHILE_WAYS: Readonly<Record<string, StepWay>> = {
  "nurse-certification": { go: "place.tb-clinic", at: ["place.tb-clinic:jobs-notice"] },
  "open-source": { go: "place.yaba", at: ["place.yaba:desk"] },
  "tech-posts": { go: "place.yaba-hub", at: ["place.yaba-hub:laptops"] },
  "be-noticed": { go: "place.yaba", at: ["place.yaba:jobs"] },
};

function qualityOf(view: NudgeView, id: string): number {
  return view.qualities?.find((quality) => quality.id === id)?.value ?? 0;
}

/** The short id of the waiting-month act that fits this life and stands open this month, or null. */
export function meanwhileOf(view: NudgeView, planned: readonly string[]): string | null {
  for (const { act, fits } of MEANWHILE) {
    const id = `activity.${act}`;
    const option = view.activities?.find((candidate) => candidate.id === id);
    if (option !== undefined && option.allowed && !planned.includes(id) && fits(view)) return act;
  }
  return null;
}

const CARE_ROUTE = "route.uk-care";
/** The care file and its decision day (R-CHAPTER-009). */
const CARE_CHAPTERS: ReadonlySet<string> = new Set(["chapter.build-the-file-care", "chapter.decision-day-care"]);
const TENURE = "tenure";
const LICENCE_STEP = "chapter.build-the-file-care.licence";
const WINDOW_STEP = "chapter.build-the-file-care.window";
const PASSPORT_STEP = "chapter.build-the-file.passport";
const ENGLISH_STEP = "chapter.build-the-file.english";
const VERIFICATION_STEP = "chapter.build-the-file-care.verification";
/** What the care visa needs before it is sent, in the route's checklist order (route.data.ts), each as the tables' step that gets it. */
const CARE_PAPERS: readonly { item: string; step: string }[] = [
  { item: "passport", step: PASSPORT_STEP },
  { item: "english", step: ENGLISH_STEP },
  { item: "tb", step: "chapter.decision-day-care.tb" },
  { item: "police", step: "chapter.decision-day-care.police" },
  { item: "salary", step: "chapter.build-the-file-care.salary" },
];

type CareView = Pick<PlayerView, "chapter"> & Partial<Pick<PlayerView, "routes" | "documents" | "activities">>;

/** The words of a tables' step: `chapter.x.step` reads `chapter.x.item.step`. */
function wordsOf(stepKey: string): string {
  const cut = stepKey.lastIndexOf(".");
  return `${stepKey.slice(0, cut)}.item.${stepKey.slice(cut + 1)}`;
}

/**
 * The care file's step the nudge names in place of the chapter's own, as the tables'
 * step key, or null for the chapter's own. A lapsed licence's renewal comes first in any month of the file. In the months
 * on the ward, the passport. While the council works, the passport, then the English test. At the application, each thing
 * the visa needs in the route's order: the first that can be got now, else the first on its way, else the window's wait.
 */
function careDetour(view: CareView, step: string): string | null {
  if (!CARE_CHAPTERS.has(view.chapter.current ?? "")) return null;
  const care = view.routes?.find((route) => route.id === CARE_ROUTE);
  if (care === undefined) return null;
  const unmet = (item: string): boolean => care.checklist.find((one) => one.id === item)?.met === false;
  const pending = (stepKey: string): boolean => {
    const paper = STEP_PAPER[stepKey];
    return paper !== undefined && (view.documents?.find((held) => held.id === paper)?.onItsWay ?? null) !== null;
  };
  const open = (stepKey: string): boolean => view.activities?.find((option) => option.id === STEP_ACTIVITY[stepKey])?.allowed === true;
  const now = (item: string, stepKey: string): boolean => unmet(item) && !pending(stepKey) && open(stepKey);
  if (unmet("licence")) return LICENCE_STEP;
  if (step === TENURE) return now("passport", PASSPORT_STEP) ? PASSPORT_STEP : null;
  if (step === "verification" && pending(VERIFICATION_STEP)) return [{ item: "passport", step: PASSPORT_STEP }, { item: "english", step: ENGLISH_STEP }].find((paper) => now(paper.item, paper.step))?.step ?? null;
  if (step !== "applied") return null;
  const missing = CARE_PAPERS.filter((paper) => unmet(paper.item));
  const first = missing.find((paper) => now(paper.item, paper.step)) ?? missing.find((paper) => pending(paper.step)) ?? missing[0];
  if (first !== undefined) return first.step;
  return care.window === "closed" ? WINDOW_STEP : null;
}

/** True while funds held for the visa are still to be given back. */
function heldFundsOpen(view: NudgeView): boolean {
  return (view.obligations ?? []).some((owed) => content.obligation[owed.entry]?.type === HELD_FUNDS);
}

/** True when the jobs board holds a job that pays more a month than the one held, and the one held is not one a way out counts the months of. */
function betterJobOnBoard(view: NudgeView): boolean {
  const held = view.job?.id ?? null;
  if (held === null) return false;
  if (view.job !== undefined && routeKeptBy({ job: view.job, ...(view.routes === undefined ? {} : { routes: view.routes }) }) !== null) return false;
  const pay = monthlyNaira(held);
  const listed = view.activities?.find((option) => option.id === "activity.job-hunt")?.params ?? [];
  return listed.some((job) => monthlyNaira(job) > pay);
}

/** A job's pay a month in naira, as the hunt's card says it; nothing for pay in another money. */
function monthlyNaira(job: string): number {
  const pay = content.activity[job as Id<"activity">]?.pay ?? null;
  return pay === null || pay.currency !== "NGN" || typeof pay.amount !== "number" ? 0 : pay.amount;
}

/** The month's naira bills at its end: the upkeep, a savings circle's share, a loan's instalment. */
function nairaDues(view: NudgeView): number {
  return (view.obligations ?? []).reduce((sum, owed) => (owed.due > 0 && content.obligation[owed.entry]?.currency === "NGN" ? sum + owed.due : sum), 0);
}

/**
 * A step already started names the wait instead of the thing to do again:
 * a paper on its way says when, a school applied to says when it answers, a hunt or a test planned
 * says to end the month, funds short of the line say how much more to show, and a step refused says when it can be
 * asked for again. Null: not started.
 */
function startedKey(view: NudgeView, own: string, stepKey: string, plannedOnly: readonly string[], has: (key: string) => boolean): { key: string; params?: Record<string, string | number> } | null {
  const month = view.month ?? 0;
  // An act done at once this month (R-ACTIVITY-015) waits on the month's end as a planned one does; the view marks it `done`.
  const done: readonly string[] = (view.activities ?? []).filter((option) => option.done).map((option) => option.id);
  const planned: readonly string[] = [...plannedOnly, ...done];
  // A now-act's "planned" words would read wrong once it is done: its own done words first, then the generic line.
  const doneKey = (key: string): string | null => (has(`${key}.done`) ? `${key}.done` : has("ui.nudge.done-now") ? "ui.nudge.done-now" : null);
  // A refusal's wait comes first: the step cannot be taken again until it is out (R-ENDORSE-002).
  const wait = refusalWait(view, stepKey);
  if (wait !== null && has(`${own}.wait`)) return { key: `${own}.wait`, params: { when: inMonths(wait, month) } };
  const paper = STEP_PAPER[stepKey];
  if (paper !== undefined) {
    const held = view.documents?.find((document) => document.id === paper);
    if (held !== undefined && held.onItsWay !== null) {
      // A hunt planned while working says so; a wait is a saving month: the board's better job
      // comes before "work and save"; else the archetype's own act for the wait (R-ACTIVITY-013).
      if (planned.includes("activity.job-hunt") && (view.job?.id ?? null) !== null) return { key: "ui.nudge.hunt-planned" };
      if (betterJobOnBoard(view) && has(BETTER_JOB)) return { key: BETTER_JOB };
      const meanwhile = meanwhileOf(view, planned);
      if (meanwhile !== null && has(`ui.nudge.meanwhile.${meanwhile}`)) return { key: `ui.nudge.meanwhile.${meanwhile}` };
      if (has(`${own}.started`)) return { key: `${own}.started`, params: { when: inMonths(held.onItsWay, month) } };
    }
  }
  // The trader's shop planned at her stall (R-ACTIVITY-016): the job step has no hunt to name, so its own planned words say it.
  if (stepKey === "chapter.find-your-feet.job" && planned.includes("activity.open-shop") && has(`${own}.planned.open-shop`)) return { key: `${own}.planned.open-shop` };
  const activity = STEP_ACTIVITY[stepKey];
  if (activity !== undefined) {
    // Planned this month: the step waits on the month's end, not on another tap.
    if (done.includes(activity)) {
      if (has(`${own}.started`)) return { key: `${own}.started` };
      const key = doneKey(own);
      if (key !== null) return { key };
    }
    if (planned.includes(activity)) {
      if (has(`${own}.planned`)) return { key: `${own}.planned` };
      if (has(`${own}.started`)) return { key: `${own}.started` };
    }
    // Another act that takes the step is planned or done: its own words where content has them.
    const also = (STEP_ACTIVITY_ALSO[stepKey] ?? []).find((other) => planned.includes(other));
    if (also !== undefined) {
      const short = also.replace(/^activity\./, "");
      if (done.includes(also)) {
        const key = doneKey(`${own}.${short}`) ?? doneKey(own);
        if (key !== null) return { key };
      }
      if (has(`${own}.planned.${short}`)) return { key: `${own}.planned.${short}` };
      if (has(`${own}.planned`)) return { key: `${own}.planned` };
    }
    // The act is shut by what it needs (the endorsement before the portfolio and the people who will write): its own
    // needs words, so the nudge never points at an act the player cannot see.
    const shutOption = view.activities?.find((candidate) => candidate.id === activity);
    if (shutOption !== undefined && !shutOption.allowed && has(`${own}.needs`)) return { key: `${own}.needs` };
    // Short of money: the nudge names the gap and a way to it, instead of the thing again; once a hunt for better pay is
    // planned it says so, and once the job's pay covers the gap within a month it says to work and save.
    const option = view.activities?.find((candidate) => candidate.id === activity);
    const naira = option?.cost.filter((cost) => cost.currency === "NGN").reduce((sum, cost) => sum + cost.amount, 0) ?? 0;
    const held = (view.pockets?.NGN.bank ?? 0) + (view.pockets?.NGN.cash ?? 0);
    if (option !== undefined && !option.affordable && naira > held) {
      if (planned.includes("activity.job-hunt")) return { key: "ui.nudge.hunt-planned" };
      // What next month leaves: the pay less the month's bills. Only when that closes the gap is "work and save" true.
      const pay = view.job?.id === null || view.job?.id === undefined ? 0 : monthlyNaira(view.job.id);
      if (pay - nairaDues(view) >= naira - held && has(`${own}.saving`)) return { key: `${own}.saving` };
      if (has(`${own}.short`)) return { key: `${own}.short`, params: { amount: formatMoney(naira - held, "NGN") } };
    }
  }
  const route = view.routes?.find((candidate) => candidate.id === STORY_ROUTE);
  if (stepKey === "chapter.build-the-file.offer") {
    const applied = route?.schools.find((school) => school.state === "pending") ?? null;
    if (applied !== null && has(`${own}.started`)) return { key: `${own}.started`, params: { when: inMonths(applied.readyMonth, month) } };
    return null;
  }
  if (stepKey === "chapter.decision-day.held" && route !== undefined && !route.funds.covered && route.funds.required > route.funds.shown && has(`${own}.short`)) {
    return { key: `${own}.short`, params: { amount: formatMoney(route.funds.required - route.funds.shown, "GBP") } };
  }
  if (stepKey === "chapter.find-your-feet.job" && planned.includes("activity.job-hunt") && has(`${own}.started`)) return { key: `${own}.started` };
  // The plane waits on the held funds: the nudge says what blocks it.
  if (stepKey === "chapter.send-off.departed" && heldFundsOpen(view) && has(`${own}.blocked`)) return { key: `${own}.blocked` };
  if (stepKey === "chapter.build-the-file.english" && planned.includes("activity.sit-english-test") && has(`${own}.started`)) return { key: `${own}.started` };
  return null;
}

/**
 * Where the character stands and the stops the map shows, each with its position, so the nudge can tell a stop on foot
 * from one that needs a fare. `home` is the home stop of the city.
 */
export interface Reach {
  here: string;
  home: string | null;
  stops: readonly { id: string; position: { latE3: number; lonE3: number } }[];
}

const MAKOKO = "place.makoko";
/** The stops whose jobs board takes a hunt (BOARD_WAY's places). */
const BOARD_STOPS: readonly string[] = BOARD_WAY.at.map((entry) => entry.split(":")[0] ?? "");

/** Metres in a straight line between two positions, as the map measures a walk (R-WORLD-017). */
function metresApart(from: Reach["stops"][number]["position"], to: Reach["stops"][number]["position"]): number {
  const cos = Math.cos((from.latE3 / 1000) * (Math.PI / 180));
  return Math.hypot((to.lonE3 - from.lonE3) * 111.32 * cos, (to.latE3 - from.latE3) * 111.32);
}

/** True when the stop is where the character stands, or close enough to walk to (R-WORLD-017's walking distance). */
function onFoot(reach: Reach, to: string): boolean {
  if (to === reach.here) return true;
  const from = reach.stops.find((stop) => stop.id === reach.here)?.position;
  const there = reach.stops.find((stop) => stop.id === to)?.position;
  return from !== undefined && there !== undefined && metresApart(from, there) <= content.tuning.city.ride.walkMetres;
}

/** The cheapest paid ride this month, in kobo: the way's flat fare under the month's fares (R-PLACE-010). */
/** The offers answered in a place of the city: the send-off at home, the parcel at the cargo office (R-STREET-010). */
export const OFFER_PLACES: Readonly<Record<string, string>> = { "offer.family-send-off": "place.family-house", "offer.parcel-shipped": "place.bode-thomas" };

/** True when every open offer waits in a place that is a ride away and the naira held pays no fare. */
function offersOutOfReach(view: NudgeView, reach: Reach): boolean {
  const held = (view.pockets?.NGN.cash ?? 0) + (view.pockets?.NGN.bank ?? 0);
  if (held >= cheapestFare(view)) return false;
  return view.offers.every((offer) => {
    const at = OFFER_PLACES[offer.entry];
    return at !== undefined && at !== reach.here && !onFoot(reach, at);
  });
}

function cheapestFare(view: NudgeView): number {
  const { fareKobo } = content.tuning.city.ride;
  const fares = Object.entries(fareKobo).filter(([way, fare]) => way !== "walk" && fare > 0).map(([, fare]) => fare);
  const bp = view.place?.fareBp ?? 10_000;
  return Math.floor((Math.min(...fares) * bp) / 10_000);
}

/**
 * When nothing can be paid, a free step: the step's stop needs a fare the naira held cannot
 * pay and is too far to walk, so the nudge names what can be done on foot instead: walking home where home is near
 * enough, the racks for a life in Makoko with no job, a job on a board within reach. Null when the step can be reached,
 * or when nothing free is near.
 */
export function freeStep(view: NudgeView & StepView, reach: Reach, has: (key: string) => boolean = hasWords): (Nudge & { about: NudgeAbout; way: StepWay }) | null {
  const held = (view.pockets?.NGN.cash ?? 0) + (view.pockets?.NGN.bank ?? 0);
  if (held >= cheapestFare(view)) return null;
  const way = stepWayOf(view);
  if (way === null || way.go === null) return null;
  if (way.at.some((entry) => entry.startsWith(`${reach.here}:`)) || onFoot(reach, way.go)) return null;
  const jobless = (view.job?.id ?? null) === null;
  const board = view.activities?.find((option) => option.id === "activity.job-hunt")?.params ?? [];
  if (reach.home !== null && reach.home !== reach.here && onFoot(reach, reach.home) && has("ui.nudge.broke.home")) return { key: "ui.nudge.broke.home", about: "step", way: { go: reach.home, at: [] } };
  if (jobless && board.includes(RACKS) && onFoot(reach, MAKOKO) && has("ui.nudge.broke.racks")) return { key: "ui.nudge.broke.racks", about: "step", way: RACKS_WAY };
  if (jobless && board.length > 0 && BOARD_STOPS.some((stop) => onFoot(reach, stop)) && has("ui.nudge.broke.job")) return { key: "ui.nudge.broke.job", about: "step", way: BOARD_WAY };
  return null;
}

/**
 * `has`: whether words exist for a key; content's and the interface's tables unless a test says otherwise. `planned`: the
 * activities in this month's plan. `reach`: where the character stands, for the free step when nothing can be paid.
 */
export function nudgeOf(view: NudgeView, has: (key: string) => boolean = hasWords, planned: readonly string[] = [], newsRead = false, reach?: Reach): Nudge & { about: NudgeAbout; way?: StepWay } {
  if (view.setpiece !== null || (view.interview?.question ?? null) !== null) return { key: "ui.nudge.setpiece", about: "setpiece" };
  // Abroad, whenever the month's dues pass the country's money held, the gap comes before the step;
  // and before any ask when one more missed instalment ends the visa.
  const { place, pockets, obligations } = view;
  const gap = place === undefined || pockets === undefined || obligations === undefined ? null : duesGap({ place, pockets, obligations, ...(view.job === undefined ? {} : { job: view.job }) });
  const visaAtStake = gap !== null && (obligations ?? []).some((owed) => owed.entry === "obligation.tuition" && owed.missed >= 1 && owed.due > 0);
  if (visaAtStake && has("ui.nudge.dues-visa")) return { key: "ui.nudge.dues-visa", params: { due: formatMoney(gap.due, gap.currency), held: formatMoney(gap.held, gap.currency) }, about: "dues" };
  // An offer answered in a place of the city (the parcel at the cargo office) does not lead while nothing can be paid and
  // that place is a ride away: the nudge would send a broke life to a fare it cannot pay, every month (R-WORLD-003).
  if (view.offers.length > 0 && !(reach !== undefined && offersOutOfReach(view, reach))) return { key: "ui.nudge.offer", about: "offer" };
  if (gap !== null) return { key: "ui.nudge.dues", params: { due: formatMoney(gap.due, gap.currency), held: formatMoney(gap.held, gap.currency) }, about: "dues" };
  // Nothing can be paid and the step's stop is a ride away: a free step on foot comes first.
  const free = reach === undefined ? null : freeStep(view, reach, has);
  if (free !== null) return free;
  // While a life in Makoko's room has no job, the racks beside it come before any other step (R-ACTIVITY-017).
  // Applied at once (R-ACTIVITY-015) counts as planned: the racks' nudge then says the wait, not the racks again.
  const huntTaken = planned.includes("activity.job-hunt") || (view.activities ?? []).some((option) => option.id === "activity.job-hunt" && option.done);
  if (racksAtHand(view)) return { key: huntTaken ? `${FIRST_CHAPTER}.item.job.started` : RACKS_STEP, about: "step" };
  const step = stepOf(view);
  if (view.chapter.current !== null && step !== null) {
    const care = CARE_CHAPTERS.has(view.chapter.current);
    // In the months on the ward, the certification comes first while she can sit it: it counts toward care.
    if (care && step === TENURE && meanwhileOf(view, planned) === "nurse-certification" && has("ui.nudge.meanwhile.nurse-certification")) return { key: "ui.nudge.meanwhile.nurse-certification", about: "step" };
    // The care file's detour names its own step in its own words.
    const detour = careDetour(view, step);
    // The story's own nudge words for the step when content has them (at most eight words), else the step's words.
    const own = detour === null ? `${view.chapter.current}.item.${step}` : wordsOf(detour);
    const started = startedKey(view, own, detour ?? `${view.chapter.current}.${step}`, planned, has);
    if (started !== null) return { ...started, about: "step" };
    // The months on the ward, counted, when there is nothing else of hers to do.
    const count = care && step === TENURE && detour === null ? wardMonths(view) : null;
    if (count !== null && has(`${own}.count`)) return { key: `${own}.count`, params: { done: count.done, need: count.need }, about: "step" };
    // A hunt missed last month: the nudge names another job on the board too.
    if (step === "job" && (view.report?.lines ?? []).some((line) => line.key === "line.activity.hunt-missed") && (view.activities?.find((option) => option.id === "activity.job-hunt")?.params?.length ?? 0) > 1 && has(`${own}.nudge.again`)) return { key: `${own}.nudge.again`, about: "step" };
    // The life's own way to the step has its own words (the nurse's clinic, the trade's motor park).
    const way = ownWay(view);
    if (way !== null && has(`${own}.nudge.${way.key}`)) return { key: `${own}.nudge.${way.key}`, about: "step" };
    // "Look into it" names the page of the life's own way out (R-CHAPTER-009), read in Japa, one tap away wherever she
    // stands, never a ride to the hub: `.needs` words open Japa, as the needs do.
    const route = view.chapter.current === FIRST_CHAPTER && step === "known" ? ownRoute(view) : null;
    if (route !== null && has(`${own}.own.needs`)) return { key: `${own}.own.needs`, params: { route: has(`${route}.short`) ? say(`${route}.short`) : lowerFirst(nameOf(route)) }, about: "step" };
    if (route !== null && has(`${own}.nudge.own`)) return { key: `${own}.nudge.own`, params: { route: lowerFirst(nameOf(route)) }, about: "step" };
    return { key: has(`${own}.nudge`) ? `${own}.nudge` : own, about: "step" };
  }
  // A report line waits when one of last month's lines asks for the player. Abroad, when the month's
  // dues pass the country's money held, that line says the gap.
  // Once News has been read for this month's report, the line waits no more.
  if (!newsRead && view.report !== null && tidyLines(view.report.lines).some(asksAttention)) return { key: "ui.nudge.report", about: "report" };
  // A chapter with every item met closes when the month ends: say that, never a goal's act over it.
  if (view.chapter.current !== null && has("ui.nudge.chapter-done")) return { key: "ui.nudge.chapter-done", about: "end" };
  // With no chapter step left, the nearest open goal names its first act (R-GOAL-003).
  const goal = view.goals?.open.find((open) => open.items.some((item) => !item.met) && has(`${open.id}.first`));
  if (goal !== undefined) return { key: `${goal.id}.first`, about: "goal" };
  return { key: "ui.nudge.end", about: "end" };
}
