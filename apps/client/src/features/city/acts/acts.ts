// Acts that answer in the place (activity:now-acts-and-month-acts, world:things-are-tappable-models): a now-act starts at the tap
// and a toast says it in a few words; only an answer the player must see to choose stands as its sheet, with Done to close.
// A now-act done this month leaves its thing until the next. The card's button itself is `actOnCard` in
// shared/words/acts.ts, which the picker and the phone use too.
import { content } from "@japacity/content";
import type { Id, PlayerView, ReportLine, SlotPick } from "@japacity/sim";

import { plannedShut } from "../../../authority/store";
import { nowActOf, nowLineWords, pickable } from "../../../shared/words/acts";
import { kioskCapReached } from "../../../shared/words/lottoLines";
import { hasWords, inMonths, nameOf, say } from "../../../shared/words/text";
import type { Ask, Thing } from "../../../shared/world/contract";

/** The paper things bought at the kiosk: their slip stays in the hand with the answer on it. */
const PAPER: ReadonlySet<string> = new Set(["activity.play-lotto", "activity.bet-slip"]);

/** True when the act's sheet is a paper slip (a ticket, a bet), not a card. */
export function isPaper(activity: string): boolean {
  return PAPER.has(activity);
}

/** The kiosk's answer to a ticket bought, and the line it says once the month's ceiling is reached (luck:kiosk-sells-lotto-tickets). */
const KIOSK_NOW = "line.activity.play-lotto.now";
export const KIOSK_CAP = "line.activity.play-lotto.cap";

/**
 * The kiosk's answer as the month stands (luck:kiosk-sells-lotto-tickets): once this month's tickets reach the
 * most one slip sells, the kiosk says so in its own voice in place of "Ticket bought". Any other answer is as it came.
 */
export function kioskAnswer(line: ReportLine, monthLines: readonly ReportLine[]): ReportLine {
  return line.key === KIOSK_NOW && kioskCapReached(monthLines) ? { ...line, key: KIOSK_CAP } : line;
}

/**
 * The acts whose answer stands as its sheet (world:things-are-tappable-models), since it carries what the player must see to choose:
 * the kiosk's ticket and the bet slip, the paper bought; the driver's answer when asking around, which names a way out; and the
 * Graduate visa granted at once. Every other act done at once is answered by its toast.
 */
const ANSWER_STAYS: ReadonlySet<string> = new Set([...PAPER, "activity.ask-around", "activity.apply-graduate"]);

/** True when an act's answer stands as its sheet rather than a toast. */
export function answerStays(activity: string): boolean {
  return ANSWER_STAYS.has(activity);
}

/** The sponsor search, whose employers answer with the month though it carries no effect of its own. */
const FIND_SPONSOR = "activity.find-sponsor";

/** True for an act whose answer comes as the month turns: the hunt, a visa's application, the sponsor search. */
function answersWithMonth(activity: string): boolean {
  if (activity === FIND_SPONSOR) return true;
  return content.activity[activity as Id<"activity">]?.effects.some((effect) => effect.type === "activity/hunt" || effect.type === "route/apply") === true;
}

/** A job's own act words, where content has them (the racks' "Work the fish racks"): the card's title and the toast name it by them. Else null. */
export function ownActOf(chosen: string | null): string | null {
  return chosen !== null && hasWords(`${chosen}.act`) ? say(`${chosen}.act`) : null;
}

/**
 * An act's name as its card and its toast say it (world:things-are-tappable-models): a job picked with its own act words is named by them,
 * so the racks' Start work is "Work the fish racks" on both, never "Look for a job"; else the act's own name.
 */
export function actNameOf(activity: string, chosen: string | null): string {
  return ownActOf(chosen) ?? nameOf(activity);
}

/** An act's toast: which act, its name, and when its answer comes, or null when none is to come; a job named in its own words shows its own picture. */
export interface ActToast {
  activity: string;
  name: string;
  tag: string | null;
  picture?: string;
}

/**
 * The toast an act done at once says as it starts (world:things-are-tappable-models): its name as its card says it, and as a tag when the answer
 * comes, a paper's in months from `month` ("Comes in 3 months", never a month's number) or the month's end for a hunt or an
 * application. The place's own line is kept in News, never on the toast.
 */
export function actToast(line: Pick<ReportLine, "params">, month: number): ActToast {
  const activity = nowActOf(line);
  const due = line.params["month"];
  const tag = typeof due === "number" ? say("ui.act.toast.comes", { when: inMonths(due, month) }) : answersWithMonth(activity) ? say("ui.act.toast.month") : null;
  const chosen = typeof line.params["param"] === "string" ? line.params["param"] : null;
  const own = ownActOf(chosen);
  return { activity, name: own ?? nameOf(activity), tag, ...(own === null || chosen === null ? {} : { picture: chosen }) };
}

/**
 * The place's answer as its sheet, for an act whose answer stands (activity:now-acts-and-month-acts, world:one-action-one-sheet): the act's name, the now-line in the speaker's words,
 * a paper bought kept as its slip, nothing more to pay, and one button, Done, that closes it.
 */
export function answerAsk(line: ReportLine, where: { who: string; clock: string }, close: () => void): Ask {
  const activity = nowActOf(line);
  const paper = isPaper(activity);
  return {
    form: paper ? "slip" : "card",
    icon: paper ? "ticket" : "hand",
    who: where.who,
    title: nameOf(activity),
    line: nowLineWords(line),
    cost: null,
    button: say("ui.world.done"),
    when: "now",
    // A card's button has no second line once the act is done; a slip's button never has one.
    ...(paper ? { reference: where.clock.toUpperCase() } : { note: "" }),
    act: close,
    dismiss: close,
  };
}

/**
 * Ways to ask about a route that stand on their sheet while shut, with the reason: the adviser
 * until a way out is heard of, the word of someone who went until the network reaches one. So "Ask about routes" never
 * opens on a sheet with nothing about routes.
 */
const STANDS_SHUT: ReadonlySet<string> = new Set(["activity.see-adviser", "activity.ask-someone-who-went"]);

/**
 * True when an act is shut only because the job it starts is already held: "Open the shop" while the shop runs. Its
 * thing is the player's own (the stall), a thing of the world, so it stays.
 */
function startedJobHeld(activity: string, need: PlayerView["activities"][number]["missing"][number]): boolean {
  if (need.type !== "not" || need.of.type !== "job/is" || need.of.activities.length !== 1) return false;
  const job = need.of.activities[0];
  return content.activity[activity as Id<"activity">]?.effects.some((effect) => effect.type === "activity/start-job" && effect.job === job) === true;
}

/**
 * The activities a place's things may offer now (world:things-are-tappable-models): those the view allows; one shut only by a paper not
 * yet held, or a way to ask about a route, which still stands with its reason; and the hunt's board with its jobs, which stays while a job is held.
 * A now-act done this month is not allowed again, and the board goes with the hunt asked this month: the thing's
 * chip shows the act again next month, not this one (activity:now-acts-and-month-acts).
 */
export function actsOffered(view: Pick<PlayerView, "activities">): string[] {
  // The act that started the job held stands too: the trader's stall stays in the market once her shop is open (activity:trader-opens-own-shop).
  const held = view.activities.filter((option) => !option.allowed && option.missing.some((need) => startedJobHeld(option.id, need))).map((option) => option.id);
  const paperShut = view.activities.filter((option) => !option.allowed && !option.done && option.missing.length > 0 && (option.missing.every((need) => need.type === "document/held") || STANDS_SHUT.has(option.id))).map((option) => option.id);
  const hunt = view.activities.find((option) => option.id === "activity.job-hunt");
  const board = hunt === undefined || hunt.done ? [] : [hunt.id, ...(hunt.params ?? [])];
  // activity:spent-body-refuses-acts: an act shut only because the body is spent stays on its thing, which says so where its button was.
  const spent = view.activities.filter((option) => option.spent === true).map((option) => option.id);
  // activity:study-days-capped, activity:paid-tech-courses: a study held back by the month's days or another path stays, and its card says which.
  const heldBack = view.activities.filter((option) => option.capped === true || option.onCourse === true).map((option) => option.id);
  // turn:free-slots-per-month: rest is never a thing's act; an empty slot already rests, and the bed's act is to lie down at once.
  return [...new Set([...pickable(view.activities).filter((option) => option.allowed).map((option) => option.id), ...paperShut, ...held, ...board, ...spent, ...heldBack])];
}

/**
 * The thing with each act done at once whose body is spent marked (activity:spent-body-refuses-acts): its chip says "You are spent. Sleep."
 * where its button was. A sheet act opens its sheet, which says it in place of the main button.
 */
export function withSpent(thing: Thing, view: Pick<PlayerView, "activities">): Thing {
  let marked = false;
  const acts = thing.acts.map((act) => {
    if (act.kind !== "do" || act.stages === undefined) return act;
    if (view.activities.find((option) => option.id === act.stages)?.spent !== true) return act;
    marked = true;
    return { ...act, spent: true };
  });
  return marked ? { ...thing, acts } : thing;
}

/**
 * The thing with each act that carries on in the plan marked (world:month-acts-carry-on): its chip says "Ongoing" with a stop. A sheet
 * act whose choice is made inside its sheet (which job, which route) stays open, since another choice can still be started.
 */
export function withPlanned(thing: Thing, plan: readonly (SlotPick | null)[], view: Pick<PlayerView, "activities">): Thing {
  let marked = false;
  const acts = thing.acts.map((act) => {
    if ((act.kind !== "do" && act.kind !== "sheet") || act.stages === undefined || act.more !== undefined) return act;
    const entry = content.activity[act.stages as Id<"activity">];
    if (entry === undefined) return act;
    const option = view.activities.find((candidate) => candidate.id === act.stages);
    const param = act.param ?? (act.kind === "do" ? (option?.params?.[0] ?? null) : entry.param === null ? null : undefined);
    if (param === undefined || !plannedShut(plan, { activity: act.stages as Id<"activity">, param })) return act;
    marked = true;
    return { ...act, planned: true };
  });
  return marked ? { ...thing, acts } : thing;
}

/**
 * The asks sheet's header (world:one-action-one-sheet): with several asks waiting, which one this is of those still waiting, so the
 * count is what is left, never "4 OF 4" over the one ask left. Over a set piece (the exam, the visa interview) nothing:
 * the set piece counts its own questions ("Question 1 of 3") and one counter is enough, never "1 of 3" over "Question 1
 * of 3" nor "3 of 3" over its first question once the other asks are answered. Null with one ask left and nothing to count.
 */
export function askHeader(at: { left: number; index: number; setpiece: Pick<NonNullable<PlayerView["setpiece"]>, "asked" | "total"> | null }): { n: number; count: number } | null {
  if (at.setpiece !== null) return null;
  if (at.left < 2) return null;
  return { n: Math.min(at.index, at.left - 1) + 1, count: at.left };
}
