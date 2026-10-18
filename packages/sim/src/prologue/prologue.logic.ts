// The prologue: docs/rules/prologue.md, R-PROLOGUE-001 to 008. The choices
// from sixteen to twenty-two that build a starting life. The steps, their
// answers, effects and draws are content; this kind walks them, and keeps the
// age picked on the age card (R-PROLOGUE-004, decision 0023).
import { allMet } from "../engine/check";
import { QUALITY } from "../engine/ids";
import { BP_WHOLE, clamp, divFloor } from "../engine/int";
import type { RegisteredKind } from "../engine/kind";
import { emit } from "../engine/kind";
import { reject } from "../engine/reject";
import type {
  BaseEvent,
  Cause,
  Command,
  Content,
  Ctx,
  Effect,
  Id,
  PlayerView,
  PrologueSlice,
  PrologueStep,
  ReadCtx,
  Rejection,
  ReportLine,
  State,
  Tuning,
  World,
} from "../engine/types";
import type { PrologueEvent } from "./prologue.events";

/** The source every prologue effect names, so its changes read as the prologue's. */
export const PROLOGUE_SOURCE = "prologue";

/**
 * step 0 is the `draw` card. Its one
 * answer makes the draw, since `initial` has no seed to draw with.
 */
const FIRST_STEP = "draw";

const AFTER_SCHOOL = "after-school";
const GRADUATION = "graduation";
/** The flag `expo` sets: the grade can fall by one (R-PROLOGUE-003, step 8). */
const CUT_CORNER = "cut-corner";

const YEAR = 12;

/**
 * R-PROLOGUE-004 (decision 0023): the steps a draw's bad outcome leads to. A retake or a strike puts the path's end
 * later; it is drawn only while the years picked still leave work after it.
 */
const SETBACKS: readonly string[] = ["retake", "strike-drag"];
/** The years worked after the path's end, never a card: the kind gives its answers, a year each, and goes on to its next. */
export const WORK = "work";
/** An age card's answer: the year the life starts at. */
const START = /^start-(\d+)$/;

/**
 * R-PROLOGUE-005: the headlines pass as these steps are answered, one each. Every path passes both.
 * The page names no steps; the school certificate and the send-off are the two every path shares.
 */
const HEADLINE_STEPS: readonly string[] = [AFTER_SCHOOL, "friend"];

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function stepEntry(content: Content, id: string): PrologueStep | null {
  return content.prologue[id] ?? null;
}

/** The step whose answer says where the life sleeps at twenty-two; Makoko's says where it was born (R-PROLOGUE-012). */
const HOME_STEP = "home";

/**
 * Where the family drawn is from (R-PROLOGUE-002): a town or a city by
 * the draw's own split, picked by its means, its siblings and its parents' schooling, so the same family is always from
 * the same place, a sibling's life too (R-PEOPLE-011), and no stream moves: nothing new is drawn.
 */
export function familyHometown(draw: NonNullable<PrologueSlice["draw"]>, numbers: Tuning["prologue"]): string | null {
  const list = draw.town === "city" ? numbers.hometowns.city : numbers.hometowns.town;
  if (list.length === 0) return null;
  const mix = draw.familyMeans * 7 + draw.siblings * 13 + (draw.parentsEducated ? 5 : 0);
  return list[mix - divFloor(mix, list.length) * list.length] ?? null;
}

/**
 * R-PROLOGUE-002: where the life is from. A fixed life names its own; a life from sixteen reads
 * it from the family drawn, unless its home answer says where it was born (the child of the water's Lagos,
 * R-PROLOGUE-012). Null until the family is drawn.
 */
export function hometownOf(state: State, content: Content): string | null {
  const own = content.scenario[state.scenario]?.hometown;
  if (own !== undefined) return own;
  const draw = state.prologue.draw;
  if (draw === null) return null;
  const numbers = content.tuning.prologue;
  const home = state.prologue.choices[HOME_STEP];
  const born = home === undefined ? undefined : numbers.hometowns.byHome[home];
  return born ?? familyHometown(draw, numbers);
}

/** R-PROLOGUE-002: the parents' chance of schooling, by family means. */
export function parentsEducatedBp(familyMeans: number, numbers: Tuning["prologue"]): number {
  return numbers.parentsEducatedBp + numbers.parentsEducatedPerPoint * familyMeans;
}

/** The grade a degree ends with, from the grade base and the two draws (R-PROLOGUE-003, step 8). */
export function gradeOf(gradeBase: number, up: boolean, down: boolean, numbers: Tuning["prologue"]): number {
  const { grade } = numbers;
  return clamp(grade.base + gradeBase + (up ? 1 : 0) - (down ? 1 : 0), grade.min, grade.max);
}

/**
 * The stories a headline can be. R-PROLOGUE-005 wants the years before the
 * game's start: stories the world announced before tick 0, oldest first. The
 * stand-in world has none, so the era pool's stories follow, in content order,
 * as flavour.
 */
function headlinePool(world: World, content: Content): Id<"news">[] {
  const before = world.news
    .filter((story) => story.since < 0 && story.stage !== "rumour")
    .sort((a, b) => a.since - b.since)
    .map((story) => story.id);
  const eras = Object.values(content.era).map((era) => era.story);
  return [...new Set([...before, ...eras])];
}

/** R-PROLOGUE-004: the year an age card's answer picks, or null for any other answer. */
export function startYearOf(answer: string): number | null {
  const found = START.exec(answer);
  return found === null ? null : Number(found[1]);
}

/** R-PROLOGUE-004: the year the life starts at, from the age card answered, or null before one is. */
export function startYear(choices: Readonly<Record<string, string>>): number | null {
  for (const answer of Object.values(choices)) {
    const year = startYearOf(answer);
    if (year !== null) return year;
  }
  return null;
}

/** Where an answer's outcome leads. */
function leadsTo(step: PrologueStep, answer: Answer, outcome: Outcome | null): string | null {
  return outcome?.next ?? answer.next ?? step.next;
}

function isSetback(step: PrologueStep, answer: Answer, outcome: Outcome): boolean {
  const next = leadsTo(step, answer, outcome);
  return next !== null && SETBACKS.includes(next);
}

/**
 * R-PROLOGUE-004: the months from entering `from` to the path's end (the years worked, or the close), the longest
 * way with no setback: every answer, whatever it requires, and every outcome of a draw but a retake or a strike.
 */
export function pathMonths(steps: Readonly<Record<string, PrologueStep>>, from: string | null, seen: readonly string[] = []): number {
  if (from === null || from === WORK) return 0;
  const step = steps[from];
  if (step === undefined) throw new Error(`The content has no prologue step ${from}.`);
  if (seen.includes(from)) throw new Error(`The prologue loops at ${from} with no setback.`);
  let longest = 0;
  for (const answer of step.answers) {
    const outcomes = answer.draw === null ? [null] : answer.draw.filter((outcome) => !isSetback(step, answer, outcome));
    for (const outcome of outcomes) longest = Math.max(longest, pathMonths(steps, leadsTo(step, answer, outcome), [...seen, from]));
  }
  return step.months + longest;
}

/**
 * R-PROLOGUE-004 (decision 0023): a draw whose retake or strike would leave no year of work before the age picked is
 * not made, and the first outcome that is no setback is taken in its place: the exam passes, the strike does not come.
 * Null when the draw is made.
 */
function spared(ctx: Ctx, step: PrologueStep, answer: Answer): Outcome | null {
  const year = startYear(ctx.state.prologue.choices);
  if (year === null || answer.draw === null) return null;
  const after = (ctx.state.quality[QUALITY.age] ?? 0) + step.months;
  const short = answer.draw.some((outcome) => isSetback(step, answer, outcome) && divFloor(after + pathMonths(ctx.content.prologue, leadsTo(step, answer, outcome)), YEAR) >= year);
  if (!short) return null;
  return answer.draw.find((outcome) => !isSetback(step, answer, outcome)) ?? null;
}

/**
 * R-PROLOGUE-004 (decision 0023): the years from the path's end to the age picked, worked one by one with the work
 * card's answers in order (the last for every year after), so the life closes at the picked year and the months into
 * it the path had reached. Returns the step after the work.
 */
function work(ctx: Ctx, entry: PrologueStep): string | null {
  const year = startYear(ctx.state.prologue.choices);
  const reached = divFloor(ctx.state.quality[QUALITY.age] ?? 0, YEAR);
  const years = year === null ? 0 : Math.max(0, year - reached);
  for (let at = 0; at < years; at += 1) {
    const answer = entry.answers[Math.min(at, entry.answers.length - 1)];
    if (answer === undefined) throw new Error("The work card has no answer.");
    ctx.apply([...answer.effects, add(QUALITY.age, entry.months)], cause());
  }
  return entry.next;
}

// ---------------------------------------------------------------------------
// The command
// ---------------------------------------------------------------------------

function cause(): Cause {
  return { source: PROLOGUE_SOURCE, param: null, terms: {} };
}

function add(quality: Id<"quality">, amount: number): Effect {
  return { type: "quality/add", quality, amount };
}

/** R-PROLOGUE-002: the family drawn on stream `prologue`. */
function drawFamily(ctx: Ctx): NonNullable<PrologueSlice["draw"]> {
  const { familyMeans, siblings, cityBp } = ctx.content.tuning.prologue;
  const means = ctx.random.between("prologue", familyMeans[0], familyMeans[1]);
  const town = ctx.random.chance("prologue", cityBp) ? "city" : "town";
  const brothers = ctx.random.between("prologue", siblings[0], siblings[1]);
  const parentsEducated = ctx.random.chance("prologue", parentsEducatedBp(means, ctx.content.tuning.prologue));
  return { familyMeans: means, town, siblings: brothers, parentsEducated };
}

/**
 * R-PROLOGUE-002: step 0's draw and the qualities it sets from their minimum.
 * A sibling's life begins holding the inviter's draw (R-PEOPLE-011), which is
 * copied here and never drawn again.
 */
function draw(ctx: Ctx): BaseEvent[] {
  const family = ctx.state.prologue.draw ?? drawFamily(ctx);
  const { familyMeans: means, town, parentsEducated } = family;
  const drawn: PrologueEvent = { type: "prologue/drawn", draw: family };
  const events = emit(ctx, "prologue", [drawn]);
  const numbers = ctx.content.tuning.prologue;
  const network = (town === "city" ? numbers.network.city : numbers.network.town) + (parentsEducated ? numbers.network.educated : 0);
  const at = (quality: Id<"quality">) => ctx.state.quality[quality] ?? 0;
  ctx.apply(
    [add(QUALITY.familyMeans, means - at(QUALITY.familyMeans)), add(QUALITY.network, network - at(QUALITY.network)), add(QUALITY.standing, numbers.standing - at(QUALITY.standing))],
    cause(),
  );
  return events;
}

type Answer = PrologueStep["answers"][number];
type Outcome = NonNullable<Answer["draw"]>[number];

/** One outcome of an answer's draw, by its basis points in order. */
function drawOutcome(ctx: Ctx, outcomes: readonly Outcome[]): Outcome {
  const roll = ctx.random.int("prologue", BP_WHOLE);
  let reached = 0;
  for (const outcome of outcomes) {
    reached += outcome.bp;
    if (roll < reached) return outcome;
  }
  const last = outcomes.at(-1);
  if (last === undefined) throw new Error("A prologue draw has no outcomes.");
  return last;
}

/** R-PROLOGUE-003, step 2: the school certificate fee strains a family under 30. */
function waec(ctx: Ctx): void {
  const { waecStrain } = ctx.content.tuning.prologue;
  if ((ctx.state.quality[QUALITY.familyMeans] ?? 0) < waecStrain.under) ctx.apply([add(QUALITY.standing, waecStrain.standing)], cause());
}

/** R-PROLOGUE-003, step 8: the grade draw, set on `quality.edu-grade`. */
function graduate(ctx: Ctx): BaseEvent[] {
  const slice = ctx.state.prologue;
  const numbers = ctx.content.tuning.prologue;
  const up = ctx.random.chance("prologue", numbers.grade.upBp);
  const down = slice.flags.includes(CUT_CORNER) && ctx.random.chance("prologue", numbers.grade.downBp);
  const grade = gradeOf(slice.gradeBase, up, down, numbers);
  ctx.apply([add(QUALITY.eduGrade, grade - (ctx.state.quality[QUALITY.eduGrade] ?? 0))], cause());
  const graded: PrologueEvent = { type: "prologue/graded", grade };
  return emit(ctx, "prologue", [graded]);
}

/** R-PROLOGUE-005: the headline that passes as this step is answered, if one does. */
function headline(ctx: Ctx, step: string): BaseEvent[] {
  const index = HEADLINE_STEPS.indexOf(step);
  if (index < 0) return [];
  const story = headlinePool(ctx.world, ctx.content)[index];
  if (story === undefined) return [];
  const passed: PrologueEvent = { type: "prologue/headline", story };
  return emit(ctx, "prologue", [passed]);
}

/**
 * `prologue/choose` (R-PROLOGUE-003). The answer must be one of the current
 * step's with its requires holding. Its effects apply, its flags and grade
 * base are kept, its draw is made, age moves by the step's months
 * (R-PROLOGUE-004), and when nothing follows the prologue closes (R-PROLOGUE-006).
 */
function choose(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "prologue/choose") throw new Error(`prologue/choose cannot handle ${command.type}.`);
  const slice = ctx.state.prologue;
  if (!slice.open || slice.step === null) return reject("not-legal", "There is no prologue open.");
  if (command.step !== slice.step) return reject("not-legal", `The prologue is at ${slice.step}, not ${command.step}.`);
  const step = stepEntry(ctx.content, slice.step);
  if (step === null) throw new Error(`The content has no prologue step ${slice.step}.`);
  const answer = step.answers.find((given) => given.id === command.answer);
  if (answer === undefined) return reject("not-legal", `The step ${step.id} has no answer ${command.answer}.`);
  if (!answer.requires.every((requirement) => ctx.check(requirement).met)) {
    return reject("not-legal", `The answer ${answer.id} is not open at ${step.id}.`);
  }

  const events: BaseEvent[] = [];
  if (slice.draw === null || Object.keys(slice.choices).length === 0) events.push(...draw(ctx));
  if (step.id === AFTER_SCHOOL) waec(ctx);
  ctx.apply(answer.effects, cause());
  const outcome = answer.draw === null ? null : (spared(ctx, step, answer) ?? drawOutcome(ctx, answer.draw));
  if (outcome !== null) ctx.apply(outcome.effects, cause());
  if (step.months > 0) ctx.apply([add(QUALITY.age, step.months)], cause());
  if (step.id === GRADUATION) events.push(...graduate(ctx));
  events.push(...headline(ctx, step.id));

  const reached = outcome?.next ?? answer.next ?? step.next;
  const workCard = reached === WORK ? stepEntry(ctx.content, WORK) : null;
  const next = workCard === null ? reached : work(ctx, workCard);
  const chosen: PrologueEvent = {
    type: "prologue/chosen",
    step: step.id,
    answer: answer.id,
    // The outcome is kept as its words key, so the next card can say it without knowing the step it came from.
    outcome: outcome === null ? null : `prologue.${step.id}.outcome.${outcome.id}`,
    next,
    flags: answer.flags,
    gradeBase: answer.gradeBase,
  };
  events.push(...emit(ctx, "prologue", [chosen]));
  if (next === null) {
    // R-PROLOGUE-006: the upkeep was opened by the last answer's effects. No turn can be spent while the
    // prologue is open, so the bank closes where the turn kind started it, at `tuning.turn.start`.
    const closed: PrologueEvent = { type: "prologue/closed" };
    events.push(...emit(ctx, "prologue", [closed]));
  }
  return events;
}

// ---------------------------------------------------------------------------
// The slice
// ---------------------------------------------------------------------------

function evolve(slice: PrologueSlice, event: PrologueEvent): PrologueSlice {
  switch (event.type) {
    case "prologue/drawn":
      return { ...slice, draw: event.draw };
    case "prologue/chosen":
      return {
        ...slice,
        step: event.next,
        choices: { ...slice.choices, [event.step]: event.answer },
        lastOutcome: event.outcome,
        flags: [...slice.flags, ...event.flags.filter((flag) => !slice.flags.includes(flag))],
        gradeBase: slice.gradeBase + event.gradeBase,
      };
    case "prologue/graded":
    case "prologue/headline":
      // The grade lives on `quality.edu-grade`; a headline is flavour and changes nothing (R-PROLOGUE-005).
      return slice;
    case "prologue/closed":
      return { ...slice, open: false, step: null };
    default: {
      const never: never = event;
      throw new Error(`Unknown prologue event ${JSON.stringify(never)}.`);
    }
  }
}

function line(key: string, params: ReportLine["params"], tone: ReportLine["tone"] = "plain", attention = false): ReportLine {
  return { key, params, tone, attention, counts: [] };
}

function lines(event: PrologueEvent): ReportLine[] {
  switch (event.type) {
    case "prologue/drawn": {
      const { familyMeans, town, siblings, parentsEducated } = event.draw;
      const drawn = line("line.prologue.drawn", { means: familyMeans, town, siblings }, "plain", true);
      return parentsEducated ? [drawn, line("line.prologue.parents-educated", {})] : [drawn];
    }
    case "prologue/graded":
      return [line("line.prologue.graded", { grade: event.grade }, "plain", true)];
    case "prologue/headline":
      return [line("line.prologue.headline", { story: event.story })];
    case "prologue/closed":
      return [line("line.prologue.closed", {}, "good", true)];
    case "prologue/chosen":
      // The answer is on the card the player just pressed, and its outcome shows on the next (R-PROLOGUE-008).
      return [];
    default: {
      const never: never = event;
      throw new Error(`Unknown prologue event ${JSON.stringify(never)}.`);
    }
  }
}

function invariants(state: State, content: Content): string[] {
  const slice = state.prologue;
  if (!slice.open) return slice.step === null ? [] : [`The prologue is closed but still at step ${slice.step}.`];
  if (slice.step === null) return ["The prologue is open with no step."];
  if (stepEntry(content, slice.step) === null) return [`The prologue is at ${slice.step}, which the content does not have.`];
  return [];
}

/** R-PROLOGUE-008: the card, its answers with `allowed`, and the draws already made. Nothing before it is drawn. Where the life is from stays after the close (R-PROLOGUE-002). */
function view(read: ReadCtx): Pick<PlayerView, "prologue" | "hometown"> {
  const slice = read.state.prologue;
  const hometown = hometownOf(read.state, read.content);
  if (!slice.open || slice.step === null) return { prologue: null, hometown };
  const step = stepEntry(read.content, slice.step);
  if (step === null) return { prologue: null, hometown };
  return {
    hometown,
    prologue: {
      step: step.id,
      answers: step.answers.map((answer) => ({ id: answer.id, allowed: allMet(read, answer.requires) })),
      lastOutcome: slice.lastOutcome,
      draw: slice.draw,
    },
  };
}

export const prologueKind: RegisteredKind<PrologueSlice, PrologueEvent> = {
  kind: "prologue",
  // R-PROLOGUE-001 and 007: open at step 0 for the prologue's own life; closed, with nothing recorded, for a fixed one.
  initial: (scenario) => ({
    open: scenario.prologue === true,
    step: scenario.prologue === true ? FIRST_STEP : null,
    draw: null,
    choices: {},
    lastOutcome: null,
    flags: [],
    gradeBase: 0,
  }),
  commands: { "prologue/choose": choose },
  evolve,
  lines,
  invariants,
  view,
};
