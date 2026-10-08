// The prologue: docs/rules/prologue.md, R-PROLOGUE-001 to 008. The choices
// from sixteen to twenty-two that build a starting life. The steps, their
// answers, effects and draws are content; this kind walks them.
import { allMet } from "../engine/check";
import { BP_WHOLE, clamp } from "../engine/int";
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
  World,
} from "../engine/types";
import type { PrologueEvent } from "./prologue.events";

/** The source every prologue effect names, so its changes read as the prologue's. */
export const PROLOGUE_SOURCE = "prologue";

/**
 * step 0 is the `draw` card. Its one
 * answer makes the draw, since `initial` has no seed to draw with.
 */
export const FIRST_STEP = "draw";

const AFTER_SCHOOL = "after-school";
const GRADUATION = "graduation";
/** The flag `expo` sets: the grade can fall by one (R-PROLOGUE-003, step 8). */
const CUT_CORNER = "cut-corner";

const AGE: Id<"quality"> = "quality.age-months";
const FAMILY_MEANS: Id<"quality"> = "quality.family-means";
const NETWORK: Id<"quality"> = "quality.network";
const STANDING: Id<"quality"> = "quality.standing";
const EDU_GRADE: Id<"quality"> = "quality.edu-grade";

/**
 * R-PROLOGUE-002's numbers that tuning does not hold.
 * `tuning.prologue.parentsEducatedBp` (2000) and `parentsEducatedPerPoint` (60),
 * `tuning.prologue.network` ({ city: 15, town: 5, educated: 10 }) and `tuning.prologue.standing` (50).
 */
export const DRAW = { parentsBp: 2000, parentsPerPoint: 60, cityNetwork: 15, townNetwork: 5, educatedNetwork: 10, standing: 50 } as const;

/**
 * Step 2's school certificate fee, paid from family means: a family under 30 feels it (R-PROLOGUE-003).
 * `tuning.prologue.waecStrain` ({ under: 30, standing: -2 }).
 */
export const WAEC = { under: 30, standing: -2 } as const;

/**
 * Step 8's grade draw: 2 plus the grade base, up 1 at 4000, down 1 at 2000 after `expo`, kept between 2 and 5.
 * `tuning.prologue.grade` ({ base: 2, upBp: 4000, downBp: 2000, min: 2, max: 5 }).
 */
export const GRADE = { base: 2, upBp: 4000, downBp: 2000, min: 2, max: 5 } as const;

/**
 * R-PROLOGUE-005: the headlines pass as these steps are answered, one each. Every path passes both.
 * the page names no steps; the school certificate and the send-off are the two every path shares.
 */
const HEADLINE_STEPS: readonly string[] = [AFTER_SCHOOL, "friend"];

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function stepEntry(content: Content, id: string): PrologueStep | null {
  return content.prologue[id] ?? null;
}

/** R-PROLOGUE-002: the parents' chance of schooling, by family means. */
export function parentsEducatedBp(familyMeans: number): number {
  return DRAW.parentsBp + DRAW.parentsPerPoint * familyMeans;
}

/** The grade a degree ends with, from the grade base and the two draws (R-PROLOGUE-003, step 8). */
export function gradeOf(gradeBase: number, up: boolean, down: boolean): number {
  return clamp(GRADE.base + gradeBase + (up ? 1 : 0) - (down ? 1 : 0), GRADE.min, GRADE.max);
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

// ---------------------------------------------------------------------------
// The command
// ---------------------------------------------------------------------------

function cause(): Cause {
  return { source: PROLOGUE_SOURCE, param: null, terms: {} };
}

function add(quality: Id<"quality">, amount: number): Effect {
  return { type: "quality/add", quality, amount };
}

/** R-PROLOGUE-002: step 0's draw, on stream `prologue`, and the qualities it sets from their minimum. */
function draw(ctx: Ctx): BaseEvent[] {
  const { familyMeans, siblings, cityBp } = ctx.content.tuning.prologue;
  const means = ctx.random.between("prologue", familyMeans[0], familyMeans[1]);
  const town = ctx.random.chance("prologue", cityBp) ? "city" : "town";
  const brothers = ctx.random.between("prologue", siblings[0], siblings[1]);
  const parentsEducated = ctx.random.chance("prologue", parentsEducatedBp(means));
  const drawn: PrologueEvent = { type: "prologue/drawn", draw: { familyMeans: means, town, siblings: brothers, parentsEducated } };
  const events = emit(ctx, "prologue", [drawn]);
  const network = (town === "city" ? DRAW.cityNetwork : DRAW.townNetwork) + (parentsEducated ? DRAW.educatedNetwork : 0);
  const at = (quality: Id<"quality">) => ctx.state.quality[quality] ?? 0;
  ctx.apply(
    [add(FAMILY_MEANS, means - at(FAMILY_MEANS)), add(NETWORK, network - at(NETWORK)), add(STANDING, DRAW.standing - at(STANDING))],
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
  if ((ctx.state.quality[FAMILY_MEANS] ?? 0) < WAEC.under) ctx.apply([add(STANDING, WAEC.standing)], cause());
}

/** R-PROLOGUE-003, step 8: the grade draw, set on `quality.edu-grade`. */
function graduate(ctx: Ctx): BaseEvent[] {
  const slice = ctx.state.prologue;
  const up = ctx.random.chance("prologue", GRADE.upBp);
  const down = slice.flags.includes(CUT_CORNER) && ctx.random.chance("prologue", GRADE.downBp);
  const grade = gradeOf(slice.gradeBase, up, down);
  ctx.apply([add(EDU_GRADE, grade - (ctx.state.quality[EDU_GRADE] ?? 0))], cause());
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
  if (slice.draw === null) events.push(...draw(ctx));
  if (step.id === AFTER_SCHOOL) waec(ctx);
  ctx.apply(answer.effects, cause());
  const outcome = answer.draw === null ? null : drawOutcome(ctx, answer.draw);
  if (outcome !== null) ctx.apply(outcome.effects, cause());
  // R-QUALITY-003 lets only the month move age, so the quality kind drops this until it allows the prologue.
  if (step.months > 0) ctx.apply([add(AGE, step.months)], cause());
  if (step.id === GRADUATION) events.push(...graduate(ctx));
  events.push(...headline(ctx, step.id));

  const next = outcome?.next ?? answer.next ?? step.next;
  const chosen: PrologueEvent = {
    type: "prologue/chosen",
    step: step.id,
    answer: answer.id,
    // the outcome is kept as its words key, so the next card can say it without knowing the step it came from.
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

/** R-PROLOGUE-008: the card, its answers with `allowed`, and the draws already made. Nothing before it is drawn. */
function view(read: ReadCtx): Pick<PlayerView, "prologue"> {
  const slice = read.state.prologue;
  if (!slice.open || slice.step === null) return { prologue: null };
  const step = stepEntry(read.content, slice.step);
  if (step === null) return { prologue: null };
  return {
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
