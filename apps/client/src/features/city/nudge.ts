// The nudge line's choice (docs/rules/world.md R-WORLD-003): one thing to notice, from the view, in
// this order: an open set piece or interview question; an open offer; the chapter's next undone step
// in its own nudge words; a report line waiting on the player; else the month's end.
import { content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";

import { duesGap } from "../../shared/words/dues";
import { formatMoney } from "../../shared/words/format";
import { asksAttention, tidyLines } from "../../shared/words/lines";
import { nextStepOf, ownWayOf } from "../../shared/words/sixteen";
import { hasWords, inMonths } from "../../shared/words/text";
import type { Nudge } from "../../shared/world/contract";

/** What the nudge points at, so a tap on it can open the matching sheet. `dues`: the month's dues abroad pass the money held; it opens the Bank. */
export type NudgeAbout = "setpiece" | "offer" | "step" | "report" | "dues" | "end";

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
}

const HUB_DESK: StepWay = { go: "place.yaba", at: ["place.yaba:desk", "place.ojuelegba:hub"] };
const PAPERS: StepWay = { go: "place.family-house", at: ["place.family-house:papers-box", "place.family-house:house"] };
const MONTH_END: StepWay = { go: null, at: [] };

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
  "chapter.decision-day.tb": { go: "place.tb-clinic", at: ["place.tb-clinic:desk"] },
  "chapter.decision-day.applied": { go: "place.visa-centre", at: ["place.visa-centre:desk"] },
  "chapter.decision-day.granted": MONTH_END,
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
  const own = ownWay(view);
  if (own !== null) return { go: own.place, at: [`${own.place}:${own.thing}`] };
  // The plane blocked by held funds: the way is the bank's counter that takes them back.
  if (view.chapter.current === "chapter.send-off" && step === "departed" && heldFundsOpen({ ...view, setpiece: null, interview: null, offers: [], report: null })) return HELD_FUNDS_WAY;
  return STEP_WAYS[`${view.chapter.current}.${step}`] ?? null;
}

/** Where held funds go back: the bank's counter (R-ROUTE-020). */
const HELD_FUNDS_WAY: StepWay = { go: "place.olokun-office", at: ["place.olokun-office:counter"] };

type StepView = Pick<PlayerView, "chapter"> & Partial<Pick<PlayerView, "scenario" | "qualities" | "pockets" | "routes" | "documents" | "job">>;

/** The chapter's next undone step: for a trader from sixteen with a shop's capital, the meetup and the page before the board. */
function stepOf(view: StepView): string | null {
  const { scenario, qualities, pockets } = view;
  if (scenario !== undefined && qualities !== undefined && pockets !== undefined) return nextStepOf({ chapter: view.chapter, scenario, qualities, pockets });
  return view.chapter.items.find((item) => !item.met)?.id ?? null;
}

/** The life's own way to a first step (the nurse's clinic, the trade's motor park), when the view carries enough to tell. */
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
};

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
};

/** Other activities that also take a step when planned: the adviser's visit looks into the route. */
const STEP_ACTIVITY_ALSO: Record<string, readonly string[]> = {
  "chapter.find-your-feet.known": ["activity.see-adviser"],
  // A trade hears of its way out at the motor park.
  "chapter.find-your-feet.heard": ["activity.ask-around"],
};

type NudgeView = Pick<PlayerView, "setpiece" | "interview" | "offers" | "chapter" | "report"> & Partial<Pick<PlayerView, "documents" | "routes" | "month" | "activities" | "pockets" | "place" | "obligations" | "job" | "scenario" | "qualities">>;

/** The nudge that sends a waiting life to the board for better pay. */
export const BETTER_JOB = "ui.nudge.better-job";
/** Held funds still open block the plane. */
const HELD_FUNDS = "held-funds";

/** True while funds held for the visa are still to be given back. */
function heldFundsOpen(view: NudgeView): boolean {
  return (view.obligations ?? []).some((owed) => content.obligation[owed.entry]?.type === HELD_FUNDS);
}

/** True when the jobs board holds a job that pays more a month than the one held. */
function betterJobOnBoard(view: NudgeView): boolean {
  const held = view.job?.id ?? null;
  if (held === null) return false;
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
 * says to end the month, and funds short of the line say how much more to show. Null: not started.
 */
function startedKey(view: NudgeView, own: string, stepKey: string, planned: readonly string[], has: (key: string) => boolean): { key: string; params?: Record<string, string | number> } | null {
  const month = view.month ?? 0;
  const paper = STEP_PAPER[stepKey];
  if (paper !== undefined) {
    const held = view.documents?.find((document) => document.id === paper);
    if (held?.state === "pending") {
      // A wait is a saving month: the board's better job comes before "work and save".
      if (betterJobOnBoard(view) && has(BETTER_JOB)) return { key: BETTER_JOB };
      if (has(`${own}.started`)) return { key: `${own}.started`, params: { when: inMonths(held.readyMonth ?? month, month) } };
    }
  }
  const activity = STEP_ACTIVITY[stepKey];
  if (activity !== undefined) {
    // Planned this month: the step waits on the month's end, not on another tap.
    if (planned.includes(activity)) {
      if (has(`${own}.planned`)) return { key: `${own}.planned` };
      if (has(`${own}.started`)) return { key: `${own}.started` };
    }
    // Another act that takes the step is planned: its own planned words where content has them.
    const also = (STEP_ACTIVITY_ALSO[stepKey] ?? []).find((other) => planned.includes(other));
    if (also !== undefined) {
      const short = also.replace(/^activity\./, "");
      if (has(`${own}.planned.${short}`)) return { key: `${own}.planned.${short}` };
      if (has(`${own}.planned`)) return { key: `${own}.planned` };
    }
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

/** `has`: whether words exist for a key; content's and the interface's tables unless a test says otherwise. `planned`: the activities in this month's plan. */
export function nudgeOf(view: NudgeView, has: (key: string) => boolean = hasWords, planned: readonly string[] = [], newsRead = false): Nudge & { about: NudgeAbout } {
  if (view.setpiece !== null || (view.interview?.question ?? null) !== null) return { key: "ui.nudge.setpiece", about: "setpiece" };
  // Abroad, whenever the month's dues pass the country's money held, the gap comes before the step;
  // and before any ask when one more missed instalment ends the visa.
  const { place, pockets, obligations } = view;
  const gap = place === undefined || pockets === undefined || obligations === undefined ? null : duesGap({ place, pockets, obligations });
  const visaAtStake = gap !== null && (obligations ?? []).some((owed) => owed.entry === "obligation.tuition" && owed.missed >= 1 && owed.due > 0);
  if (visaAtStake && has("ui.nudge.dues-visa")) return { key: "ui.nudge.dues-visa", params: { due: formatMoney(gap.due, gap.currency), held: formatMoney(gap.held, gap.currency) }, about: "dues" };
  if (view.offers.length > 0) return { key: "ui.nudge.offer", about: "offer" };
  if (gap !== null) return { key: "ui.nudge.dues", params: { due: formatMoney(gap.due, gap.currency), held: formatMoney(gap.held, gap.currency) }, about: "dues" };
  const step = stepOf(view);
  if (view.chapter.current !== null && step !== null) {
    // The story's own nudge words for the step when content has them (at most eight words), else the step's words.
    const own = `${view.chapter.current}.item.${step}`;
    const started = startedKey(view, own, `${view.chapter.current}.${step}`, planned, has);
    if (started !== null) return { ...started, about: "step" };
    // The life's own way to the step has its own words (the nurse's clinic, the trade's motor park).
    const way = ownWay(view);
    if (way !== null && has(`${own}.nudge.${way.key}`)) return { key: `${own}.nudge.${way.key}`, about: "step" };
    return { key: has(`${own}.nudge`) ? `${own}.nudge` : own, about: "step" };
  }
  // A report line waits when one of last month's lines asks for the player. Abroad, when the month's
  // dues pass the country's money held, that line says the gap.
  // Once News has been read for this month's report, the line waits no more.
  if (!newsRead && view.report !== null && tidyLines(view.report.lines).some(asksAttention)) return { key: "ui.nudge.report", about: "report" };
  return { key: "ui.nudge.end", about: "end" };
}
