// The years before, as the page tells them (prologue:printed-page-hands-over): the view keeps no prologue once it closes
// (prologue:closing-opens-home-charges), so while the presets run the screen keeps the family the game drew and each step's answer and
// outcome on the device, and the page reads them back as fact chips: the school certificate, the course or the
// trade, a retake or a strike as a setback with the work it cost, the service. A life whose trail was lost reads its path
// from the life as it stands.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { Award, BookOpen, Briefcase, CalendarX, Flag, GraduationCap, Hammer, House, Store, TriangleAlert, Wallet } from "lucide-react";
import type { ComponentType } from "react";

import type { MarkState } from "../../shared/ui/Mark";
import { formatMoney } from "../../shared/words/format";
import { nextMonthWords } from "../../shared/words/living";
import { gradeShort, sixteenPath } from "../../shared/words/sixteen";
import { hasWords, say, sayCount, words } from "../../shared/words/text";
import { browserStorage, TRAIL_KEY } from "../../shared/storage/storage";

type Draw = NonNullable<NonNullable<PlayerView["prologue"]>["draw"]>;

export interface TrailStep {
  step: string;
  answer: string;
  /** The outcome the answer's draw gave, once the next card says it. */
  outcome: string | null;
}

export interface Trail {
  draw: Draw | null;
  steps: TrailStep[];
  /**
   * The steps at the end that came in at once from the server's reply (server:server-plays-prologue-preset), still to come onto the
   * page one after another (prologue:archetype-presets-answers). Absent once the page has shown them.
   */
  fresh?: number;
}


const EMPTY: Trail = { draw: null, steps: [] };

function isTrail(value: unknown): value is Trail {
  if (typeof value !== "object" || value === null) return false;
  const { draw, steps, fresh } = value as Record<string, unknown>;
  return (draw === null || typeof draw === "object") && (fresh === undefined || (typeof fresh === "number" && Number.isInteger(fresh))) && Array.isArray(steps) && steps.every((one) => typeof one === "object" && one !== null && typeof (one as TrailStep).step === "string" && typeof (one as TrailStep).answer === "string");
}

export function readTrail(): Trail {
  try {
    const raw = browserStorage()?.getItem(TRAIL_KEY) ?? null;
    if (raw === null) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    return isTrail(parsed) ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

function keepTrail(trail: Trail): void {
  try {
    browserStorage()?.setItem(TRAIL_KEY, JSON.stringify(trail));
  } catch {
    // A private window may refuse storage; the page then reads the life as it stands.
  }
}

/** Keeps an answer about to be sent; the opening draw's answer starts a new trail. */
export function noteAnswer(step: string, answer: string, first: boolean): void {
  const kept = first ? EMPTY : readTrail();
  keepTrail({ ...kept, steps: [...kept.steps, { step, answer, outcome: null }] });
}

/** Keeps what the card now on screen says of the last answer: the draw once made, and the outcome its draw gave. */
export function noteCard(draw: Draw | null, outcome: string | null): void {
  const kept = readTrail();
  const last = kept.steps.at(-1);
  const steps = last !== undefined && last.outcome === null && outcome !== null ? [...kept.steps.slice(0, -1), { ...last, outcome }] : kept.steps;
  if (draw === kept.draw && steps === kept.steps) return;
  keepTrail({ draw: draw ?? kept.draw, steps });
}

/**
 * Keeps the steps the server played in one request (server:server-plays-prologue-preset) as the cards would have kept them one by one: each
 * answer with the outcome its draw gave, the draw once made; the opening draw starts a new trail. They are marked fresh,
 * so the page brings them on one after another.
 */
export function noteSteps(steps: readonly { step: string; answer: string; draw: Draw | null; outcome: string | null }[]): void {
  const first = steps[0];
  if (first === undefined) return;
  const kept = first.step === "draw" ? EMPTY : readTrail();
  const draw = steps.findLast((one) => one.draw !== null)?.draw ?? kept.draw;
  keepTrail({ draw, steps: [...kept.steps, ...steps.map(({ step, answer, outcome }) => ({ step, answer, outcome }))], fresh: steps.length });
}

/** A new life's years begin: nothing kept from before stands on its page while the server plays them. */
export function startTrail(): void {
  keepTrail(EMPTY);
}

/** The page has brought the fresh steps on: they are ordinary trail from now. */
export function trailShown(): void {
  const kept = readTrail();
  if (kept.fresh !== undefined) keepTrail({ draw: kept.draw, steps: kept.steps });
}

export interface YearChip {
  id: string;
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  label: string;
  note: string | null;
  state: MarkState | null;
}

const YEAR = 12;

function monthsOf(step: string): number {
  return content.prologue[step]?.months ?? 0;
}

/**
 * The work each setback cost, by its place in the trail (prologue:age-advances-with-steps, decision 0023). The age picked is the age the
 * life starts at, so a retake (its year and the exam again) or a strike puts the path's end later and leaves fewer years
 * of work before that age: the years of work the setback moved the end past, in months, counting the setbacks in turn.
 */
function workLost(steps: readonly TrailStep[]): Map<number, number> {
  const costs = new Map<number, number>();
  for (const [at, one] of steps.entries()) {
    if (one.step === "retake" && one.answer === "again") costs.set(at, monthsOf("retake") + (steps[at + 1]?.step === "exam" ? monthsOf("exam") : 0));
    if (one.step === "strike-drag") costs.set(at, monthsOf("strike-drag"));
  }
  const end = content.tuning.prologue.startAgeMonths + steps.reduce((sum, one) => sum + monthsOf(one.step), 0);
  let reached = end - [...costs.values()].reduce((sum, cost) => sum + cost, 0);
  const lost = new Map<number, number>();
  for (const [at, cost] of costs) {
    const before = Math.floor(reached / YEAR);
    reached += cost;
    lost.set(at, (Math.floor(reached / YEAR) - before) * YEAR);
  }
  return lost;
}

function lostWords(months: number): string {
  const years = Math.floor(months / YEAR);
  return sayCount("ui.page.year.lost", years, { count: years });
}

/** The route a step's answer heard of (`route/hear`, the send-off's crowds), or null. */
export function heardAt(one: Pick<TrailStep, "step" | "answer">): string | null {
  const answer = content.prologue[one.step]?.answers.find((each) => each.id === one.answer);
  for (const effect of answer?.effects ?? []) if (effect.type === "route/hear" && hasWords(`prologue.page.way.${effect.route}`)) return effect.route;
  return null;
}

/**
 * The way out the years before heard of, said once under So far as the life is handed over (prologue:printed-page-hands-over,
 * chapter:first-chapter-mission-card): "Heard of health care at a send-off"; null where the trail heard of none.
 */
export function heardWords(trail: Trail): string | null {
  for (const one of trail.steps) {
    const route = heardAt(one);
    if (route !== null) return say("ui.page.heard", { way: say(`prologue.page.way.${route}`) });
  }
  return null;
}

/**
 * The chips of the years before, in the order they were lived, from the trail; from the life's path when the trail is
 * lost. `water`: the child of the water's own years (prologue:makoko-start-never-a-trap): school by canoe, the
 * fish racks in place of a shop counter.
 */
export function yearChips(trail: Trail, life: Pick<PlayerView, "scenario" | "qualities" | "pockets">, water = false): YearChip[] {
  const own = (key: string): string => (water && hasWords(`${key}.water`) ? say(`${key}.water`) : say(key));
  const chips: YearChip[] = [];
  const steps = trail.steps;
  const subjects = steps.find((one) => one.step === "subjects")?.answer ?? null;
  const visited = new Set(steps.map((one) => one.step));
  if (steps.length === 0) {
    // No trail (a reload lost it): the path as lived, without the setbacks the view cannot say.
    const path = sixteenPath(life);
    if (path === null) return chips;
    chips.push({ id: "waec", icon: Award, label: say("ui.page.year.waec"), note: null, state: "done" });
    if (path === "degree") chips.push({ id: "university", icon: GraduationCap, label: say("ui.page.year.university"), note: null, state: "done" });
    return chips;
  }
  const lost = workLost(steps);
  for (const [at, one] of steps.entries()) {
    const after = steps[at + 1]?.step ?? null;
    switch (one.step) {
      case "after-school":
        chips.push({ id: "waec", icon: Award, label: own("ui.page.year.waec"), note: subjects === null ? null : words(`prologue.subjects.answer.${subjects}`), state: "done" });
        break;
      case "exam":
        // A failed exam is the retake's setback; only the exam that settles the way gets a chip of its own.
        if (after === "course") chips.push({ id: "exam", icon: BookOpen, label: say("ui.page.year.exam"), note: say("ui.page.year.exam.passed"), state: "done" });
        else if (after !== "retake" || !steps.slice(at + 1).some((later) => later.step === "exam")) {
          if (!visited.has("course")) chips.push({ id: "exam", icon: BookOpen, label: say("ui.page.year.exam"), note: say("ui.page.year.exam.failed"), state: "failed" });
        }
        break;
      case "retake":
        if (one.answer === "again") chips.push({ id: `retake-${String(at)}`, icon: TriangleAlert, label: say("ui.page.year.retake"), note: lostWords(lost.get(at) ?? 0), state: "setback" });
        break;
      case "course":
        chips.push({ id: "university", icon: GraduationCap, label: say(steps.some((later) => later.step === "university" && later.answer === "private") ? "ui.page.year.private" : "ui.page.year.university"), note: words(`prologue.course.answer.${one.answer}`), state: visited.has("graduation") ? "done" : "waiting" });
        break;
      case "strike-drag":
        chips.push({ id: "strike", icon: CalendarX, label: say("ui.page.year.strike"), note: lostWords(lost.get(at) ?? 0), state: "setback" });
        break;
      case "service":
        chips.push({ id: "service", icon: Flag, label: say("ui.page.year.service"), note: say(`ui.page.year.service.${one.answer}`), state: one.answer === "skip" ? "failed" : "done" });
        break;
      case "master":
        chips.push({ id: "master", icon: Hammer, label: say("ui.page.year.master"), note: words(`prologue.master.answer.${one.answer}`), state: "done" });
        break;
      case "years":
        if (one.answer === "leave") chips.push({ id: "left", icon: TriangleAlert, label: say("ui.page.year.left"), note: null, state: "setback" });
        break;
      case "settlement": {
        const outcome = one.outcome?.replace(/^prologue\.settlement\.outcome\./, "") ?? null;
        if (outcome !== null && hasWords(`ui.page.year.settlement.${outcome}`)) chips.push({ id: "settlement", icon: Briefcase, label: say("ui.page.year.settlement"), note: say(`ui.page.year.settlement.${outcome}`), state: outcome === "cheated" ? "failed" : "done" });
        break;
      }
      case "shop": {
        const years = Math.round((content.prologue["shop"]?.months ?? 0) / 12);
        chips.push({ id: "shop", icon: Store, label: own("ui.page.year.shop"), note: say("ui.page.year.shop.years", { count: years }), state: "done" });
        break;
      }
      default:
        break;
    }
  }
  return chips;
}

/**
 * The home the last card chose, by the living costs it opened (prologue:closing-opens-home-charges), from content's own answers. `prepaid`:
 * the months until a rent paid upfront is due again, for the room in a compound (prologue:front-door-three-screens, obligation:prepaid-entries-skip-first-charge).
 */
function homeChosen(view: Pick<PlayerView, "obligations">): { answer: string; amount: number; prepaid: number | null; rent: boolean } | null {
  for (const answer of content.prologue["home"]?.answers ?? []) {
    for (const effect of answer.effects) {
      if (effect.type !== "obligation/open" || typeof effect.amount !== "number") continue;
      const owed = view.obligations.find((obligation) => obligation.entry === effect.obligation && obligation.amount === effect.amount);
      const entry = content.obligation[effect.obligation];
      const prepaid = entry?.prepaid === true ? (entry.everyMonths ?? null) : null;
      if (owed !== undefined && hasWords(`ui.page.home.${answer.id}`)) return { answer: answer.id, amount: owed.amount, prepaid, rent: entry?.type === "rent" };
    }
  }
  return null;
}

/**
 * The story the years built, as chips: where the character sleeps and
 * what it costs, a shop's capital in hand, and a grade that keeps the master's and the bank shut.
 */
export function storyChips(view: PlayerView): YearChip[] {
  const told: YearChip[] = [];
  const home = homeChosen(view);
  if (home !== null) {
    const note = home.prepaid === null ? nextMonthWords(home.amount, home.rent) : say("ui.page.home.costs.prepaid", { count: home.prepaid });
    told.push({ id: "home", icon: House, label: say(`ui.page.home.${home.answer}`), note, state: null });
  }
  if (sixteenPath(view) === "capital") told.push({ id: "capital", icon: Wallet, label: say("ui.page.capital"), note: formatMoney(view.pockets.NGN.bank + view.pockets.NGN.cash, "NGN"), state: null });
  if (gradeShort(view)) told.push({ id: "grade", icon: GraduationCap, label: say("ui.page.year.grade"), note: say("ui.page.year.grade.short"), state: "setback" });
  return told;
}
