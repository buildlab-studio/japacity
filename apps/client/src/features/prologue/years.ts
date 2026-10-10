// The years before, as the page tells them (prologue.md R-PROLOGUE-014): the view keeps no prologue once it closes
// (R-PROLOGUE-006), so while the presets run the screen keeps the family the game drew and each step's answer and
// outcome on the device, and the page reads them back as fact chips: the school certificate, the course or the
// trade, a retake or a strike as a setback with its months, the service. A life whose trail was lost reads its path
// from the life as it stands.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { Award, BookOpen, Briefcase, CalendarX, Flag, GraduationCap, Hammer, House, Store, TriangleAlert, Wallet } from "lucide-react";
import type { ComponentType } from "react";

import type { MarkState } from "../../shared/ui/Mark";
import type { Tone } from "../../shared/ui/ToneTag";
import { formatMoney } from "../../shared/words/format";
import { gradeShort, sixteenPath } from "../../shared/words/sixteen";
import { hasWords, say, sayCount, words } from "../../shared/words/text";

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
}

/** The one localStorage key the trail is kept under, beside the door's run. */
export const TRAIL_KEY = "japacity.door.years";

const EMPTY: Trail = { draw: null, steps: [] };

function storage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function isTrail(value: unknown): value is Trail {
  if (typeof value !== "object" || value === null) return false;
  const { draw, steps } = value as Record<string, unknown>;
  return (draw === null || typeof draw === "object") && Array.isArray(steps) && steps.every((one) => typeof one === "object" && one !== null && typeof (one as TrailStep).step === "string" && typeof (one as TrailStep).answer === "string");
}

export function readTrail(): Trail {
  try {
    const raw = storage()?.getItem(TRAIL_KEY) ?? null;
    if (raw === null) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    return isTrail(parsed) ? parsed : EMPTY;
  } catch {
    return EMPTY;
  }
}

function keepTrail(trail: Trail): void {
  try {
    storage()?.setItem(TRAIL_KEY, JSON.stringify(trail));
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

export interface YearChip {
  id: string;
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  label: string;
  note: string | null;
  state: MarkState | null;
}

function monthsLost(step: string): string {
  const months = content.prologue[step]?.months ?? 0;
  return sayCount("ui.page.year.lost", months, { count: months });
}

/** The chips of the years before, in the order they were lived, from the trail; from the life's path when the trail is lost. */
export function yearChips(trail: Trail, life: Pick<PlayerView, "scenario" | "qualities" | "pockets">): YearChip[] {
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
  for (const [at, one] of steps.entries()) {
    const after = steps[at + 1]?.step ?? null;
    switch (one.step) {
      case "after-school":
        chips.push({ id: "waec", icon: Award, label: say("ui.page.year.waec"), note: subjects === null ? null : words(`prologue.subjects.answer.${subjects}`), state: "done" });
        break;
      case "exam":
        // A failed exam is the retake's setback; only the exam that settles the way gets a chip of its own.
        if (after === "course") chips.push({ id: "exam", icon: BookOpen, label: say("ui.page.year.exam"), note: say("ui.page.year.exam.passed"), state: "done" });
        else if (after !== "retake" || !steps.slice(at + 1).some((later) => later.step === "exam")) {
          if (!visited.has("course")) chips.push({ id: "exam", icon: BookOpen, label: say("ui.page.year.exam"), note: say("ui.page.year.exam.failed"), state: "failed" });
        }
        break;
      case "retake":
        if (one.answer === "again") chips.push({ id: `retake-${String(at)}`, icon: TriangleAlert, label: say("ui.page.year.retake"), note: monthsLost("retake"), state: "setback" });
        break;
      case "course":
        chips.push({ id: "university", icon: GraduationCap, label: say(steps.some((later) => later.step === "university" && later.answer === "private") ? "ui.page.year.private" : "ui.page.year.university"), note: words(`prologue.course.answer.${one.answer}`), state: visited.has("graduation") ? "done" : "waiting" });
        break;
      case "strike-drag":
        chips.push({ id: "strike", icon: CalendarX, label: say("ui.page.year.strike"), note: monthsLost("strike-drag"), state: "setback" });
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
        chips.push({ id: "shop", icon: Store, label: say("ui.page.year.shop"), note: say("ui.page.year.shop.years", { count: years }), state: "done" });
        break;
      }
      default:
        break;
    }
  }
  return chips;
}

/** The home the last card chose, by the living costs it opened (R-PROLOGUE-006), from content's own answers. */
function homeChosen(view: Pick<PlayerView, "obligations">): { answer: string; amount: number } | null {
  for (const answer of content.prologue["home"]?.answers ?? []) {
    for (const effect of answer.effects) {
      if (effect.type !== "obligation/open" || typeof effect.amount !== "number") continue;
      const owed = view.obligations.find((obligation) => obligation.entry === effect.obligation && obligation.amount === effect.amount);
      if (owed !== undefined && hasWords(`ui.page.home.${answer.id}`)) return { answer: answer.id, amount: owed.amount };
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
  if (home !== null) told.push({ id: "home", icon: House, label: say(`ui.page.home.${home.answer}`), note: say("ui.page.home.costs", { amount: formatMoney(home.amount, "NGN") }), state: null });
  if (sixteenPath(view) === "capital") told.push({ id: "capital", icon: Wallet, label: say("ui.page.capital"), note: formatMoney(view.pockets.NGN.bank + view.pockets.NGN.cash, "NGN"), state: null });
  if (gradeShort(view)) told.push({ id: "grade", icon: GraduationCap, label: say("ui.page.year.grade"), note: say("ui.page.year.grade.short"), state: "setback" });
  return told;
}

export interface FamilyCard {
  title: string;
  tags: { tone: Tone; words: string }[];
}

/** The means a family must reach to pay for a private university, from content's own answer. */
function comfortableFrom(): number {
  for (const answer of content.prologue["university"]?.answers ?? []) {
    for (const requirement of answer.requires) {
      if (requirement.type === "quality/min" && requirement.quality === "quality.family-means") return requirement.value;
    }
  }
  return content.quality["quality.family-means"]?.max ?? 0;
}

/**
 * The family the game drew (R-PROLOGUE-002) as a two-line card: its means as the title, with its ups and downs as small
 * tags. The child of the water grew up on the lagoon (R-PROLOGUE-012): its own title in place of the town and means.
 */
export function familyCard(draw: Draw, water: boolean): FamilyCard {
  const means = draw.familyMeans < content.tuning.prologue.waecStrain.under ? "low" : draw.familyMeans < comfortableFrom() ? "middle" : "high";
  const tags: FamilyCard["tags"] = [];
  if (!water) tags.push(draw.town === "city" ? { tone: "up", words: say("ui.page.family.city") } : { tone: "down", words: say("ui.page.family.town") });
  tags.push(draw.parentsEducated ? { tone: "up", words: say("ui.page.family.schooled") } : { tone: "down", words: say("ui.page.family.unschooled") });
  tags.push({ tone: "plain", words: sayCount("ui.page.family.siblings", draw.siblings, { count: draw.siblings }) });
  return { title: say(water ? "ui.page.family.water" : `ui.page.family.${means}`), tags };
}
