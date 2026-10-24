// Test support for the route and set piece rule tests: a life with its papers
// in hand, and the steps from hearing of the UK route to the visa decision,
// each played through `step`. Nothing in the simulation imports this file.
import type { Registry } from "../engine/kind";
import { drawAt, scaleDraw } from "../engine/random";
import { stepWith } from "../engine/step";
import type { Cause, Content, Ctx, Effect, Id, Random, ReportLine, RouteState, ScenarioEntry, SlotPick, Stream, Terms, Tuning } from "../engine/types";
import { registry } from "../kinds";
import type { Game } from "./play";
import { start } from "./play";
import { routeOf } from "./read";
import { standInWorld } from "../world/standIn";
import { offerChanceBp } from "../route/route.logic";
import { NORTHGATE, READY, UK_ROUTE } from "./ids";

/** Smallest units in one naira or one pound. */
export const UNIT = 100;

export interface LifeOptions {
  /** The starting life the ready life is built from. The graduate by default. */
  from?: Id<"scenario">;
  /** Qualities over the ready life's. */
  qualities?: Partial<Record<Id<"quality">, number>>;
  /** Months already worked in each job, over the ready life's own: a track record with no job held now. */
  tenure?: Partial<Record<Id<"activity">, number>>;
  pockets?: ScenarioEntry["pockets"];
  documents?: ScenarioEntry["documents"];
  seed?: string;
  /** Route numbers over the content's. */
  tuning?: Partial<Tuning["route"]>;
  /** World variables over the stand-in's, tick by tick. */
  vars?: (tick: number) => Record<Id<"var">, number>;
  /** True: no story reaches the character, so nobody hears of a route through the news. */
  quiet?: boolean;
  /** Content changed before play, after the ready life is added. */
  change?: (content: Content) => Content;
  /** The registry to step with. The real one by default. */
  kinds?: Registry;
}

/** The ready life's papers: passport, transcript, an English band of 7.0 and a TB certificate, all in date for two years. */
export const READY_PAPERS: ScenarioEntry["documents"] = [
  { document: "document.passport", monthsLeft: 60, value: null },
  { document: "document.transcript", monthsLeft: null, value: null },
  { document: "document.english-test", monthsLeft: 24, value: 70 },
  { document: "document.tb-certificate", monthsLeft: 24, value: null },
];

/**
 * The graduate, with its papers in hand and £40,000 and ₦2,000,000 in the bank, so a
 * test reaches the visa in a few turns, and ₦1,500,000 in cash, which with decision 0014
 * is a float above the line: its upkeep is taken from the bank first on the way. The content
 * is the one given, with this life added.
 */
export function readyContent(base: Content, options: LifeOptions = {}): Content {
  const from = options.from ?? "scenario.graduate";
  const life = base.scenario[from];
  if (life === undefined) throw new Error(`The content has no ${from} to build the ready life from.`);
  const ready: ScenarioEntry = {
    ...life,
    id: READY,
    qualities: { ...life.qualities, ...options.qualities } as ScenarioEntry["qualities"],
    tenure: { ...life.tenure, ...options.tenure } as ScenarioEntry["tenure"],
    pockets: options.pockets ?? { NGN: { bank: 2000000 * UNIT, cash: 1500000 * UNIT }, GBP: { bank: 40000 * UNIT, cash: 0 } },
    documents: options.documents ?? READY_PAPERS,
  };
  const used: Content = {
    ...base,
    scenario: { ...base.scenario, [READY]: ready },
    tuning: { ...base.tuning, route: { ...base.tuning.route, ...options.tuning } },
  };
  return options.change === undefined ? used : options.change(used);
}

export function readyLife(base: Content, options: LifeOptions = {}): Game {
  const used = readyContent(base, options);
  return start({
    scenario: READY,
    content: used,
    seed: options.seed ?? "seed-1",
    ...(options.kinds === undefined ? {} : { kinds: options.kinds }),
    worldAt: (tick) => {
      const world = standInWorld("world-1", tick, used);
      return { ...world, vars: { ...world.vars, ...options.vars?.(tick) }, news: options.quiet === true ? [] : world.news };
    },
  });
}

export function slot(activity: Id<"activity">, param: string | null = null): SlotPick {
  return { activity, param };
}

export function uk(game: Game): RouteState {
  const held = game.state.route[UK_ROUTE];
  if (held === undefined) throw new Error("The state holds no UK route.");
  return held;
}

function expectState(game: Game, want: RouteState["state"]): void {
  if (uk(game).state !== want) throw new Error(`The UK route is ${uk(game).state}, expected ${want}.`);
}

/** Months pass, every slot resting, until the route is heard of: by month 3 at the latest (route:friend-tells-by-month). */
export function toHeard(game: Game): void {
  for (let month = 0; month < 5 && uk(game).state === "unknown"; month += 1) game.endTurn();
  expectState(game, "heard");
}

/** Months pass until the route is heard of, then it is looked into. */
export function toKnown(game: Game): void {
  if (uk(game).state === "unknown") toHeard(game);
  expectState(game, "heard");
  game.endTurn([slot("activity.look-into-route", UK_ROUTE)]);
  expectState(game, "known");
}

/** Applies to a school on a known route and plays months until it answers. */
export function toAnswer(game: Game, school: Id<"school"> = NORTHGATE): void {
  if (uk(game).state !== "known") toKnown(game);
  game.endTurn([slot("activity.apply-to-school", school)]);
  for (let month = 0; month < 5 && uk(game).schools[school]?.state === "pending"; month += 1) game.endTurn();
}

export function toOffer(game: Game, school: Id<"school"> = NORTHGATE): void {
  toAnswer(game, school);
  if (uk(game).schools[school]?.state !== "offer") throw new Error(`${school} gave no offer with this seed.`);
}

export function toDeposit(game: Game, school: Id<"school"> = NORTHGATE): void {
  toOffer(game, school);
  game.accept({ type: "route/pay-deposit", route: UK_ROUTE, school });
}

/** One month end with the deposit paid: the funds check runs once. */
export function toHeld(game: Game, school: Id<"school"> = NORTHGATE): void {
  toDeposit(game, school);
  game.endTurn();
  if (uk(game).funds.heldMonths !== 1) throw new Error(`The funds were held ${String(uk(game).funds.heldMonths)} months, expected 1.`);
}

/** Sends the visa application from a held file. The interview opens. */
export function toApplied(game: Game, school: Id<"school"> = NORTHGATE): void {
  toHeld(game, school);
  game.endTurn([slot("activity.apply-for-visa")]);
  expectState(game, "applying");
}

/** Answers every open question with its first answer. */
export function answerFirst(game: Game): void {
  for (let guard = 0; guard < 10; guard += 1) {
    const question = game.view().setpiece?.question;
    if (question === undefined || question === null) return;
    const answer = question.answers[0];
    if (answer === undefined) throw new Error(`${question.id} has no answers.`);
    game.accept({ type: "setpiece/answer", question: question.id, answer });
  }
  throw new Error("The set piece did not close.");
}

/** From a ready life to the decision month's end, answering first answers. */
export function toDecision(game: Game, school: Id<"school"> = NORTHGATE): void {
  toApplied(game, school);
  answerFirst(game);
  game.endTurn();
}

/** The nth draw of a stream for a seed, scaled to a range, as `ctx.random.int` gives it. */
export function draw(seed: string, stream: Stream, n: number, range: number): number {
  return scaleDraw(drawAt(seed, stream, n), range);
}

/** Whether a seed's first school answer, from a school the life has not applied to before, is an offer for this grade (route:school-answers-by-grade). */
export function offeredWith(seed: string, content: Content, school: Id<"school">, grade: number): boolean {
  const entry = content.school[school];
  if (entry === undefined) throw new Error(`The content has no ${school}.`);
  // The first school draw is the wait, the second the offer.
  return draw(seed, "school", 1, 10000) < offerChanceBp(entry, grade, content.tuning.route);
}

/** The first of `seed-0`, `seed-1`, ... that passes. Deterministic, so a test may pin its draws. */
export function seedWhere(ok: (seed: string) => boolean): string {
  for (let i = 0; i < 20000; i += 1) {
    const seed = `seed-${String(i)}`;
    if (ok(seed)) return seed;
  }
  throw new Error("No seed passes.");
}

/** Whether a seed's first school draw is an offer from Northgate for a grade of 4 (route:school-answers-by-grade). */
export function northgateOffers(content: Content, seed: string): boolean {
  const entry = content.school[NORTHGATE];
  if (entry === undefined) throw new Error(`The content has no ${NORTHGATE}.`);
  return draw(seed, "school", 1, 10000) < offerChanceBp(entry, 4, content.tuning.route);
}

/** The first `notice-n` seed whose job draw lands under the raise chance when `hit`, or over it when not. */
export function raiseSeed(content: Content, hit: boolean): string {
  const chance = content.tuning.activity.raiseChanceBp;
  for (let n = 0; n < 200; n += 1) {
    const seed = `notice-${String(n)}`;
    if (draw(seed, "job", 0, 10000) < chance === hit) return seed;
  }
  throw new Error("No seed found.");
}

/** The questions a set piece asks, drawn on `visa` from position `from` out of `pool`, as route:set-piece-draws-questions draws them. */
export function drawnQuestions(seed: string, pool: readonly string[], ask: number, from = 0): string[] {
  const left = [...pool];
  const asked: string[] = [];
  for (let n = from; asked.length < ask && left.length > 0; n += 1) {
    const [picked] = left.splice(draw(seed, "visa", n, left.length), 1);
    if (picked !== undefined) asked.push(picked);
  }
  return asked;
}

/** What a watched effect has done so far: how often it ran and the draws it made, by stream. */
export interface Watch {
  calls: number;
  draws: Partial<Record<Stream, number>>;
}

/** A Ctx like the one given whose draws are also counted in `watch`. */
function counted(ctx: Ctx, watch: Watch): Ctx {
  const count = (stream: Stream): void => {
    watch.draws[stream] = (watch.draws[stream] ?? 0) + 1;
  };
  const random: Random = {
    int(stream, n) {
      count(stream);
      return ctx.random.int(stream, n);
    },
    between(stream, min, max) {
      count(stream);
      return ctx.random.between(stream, min, max);
    },
    chance(stream, bp) {
      count(stream);
      return ctx.random.chance(stream, bp);
    },
  };
  return Object.create(ctx, { random: { value: random } }) as Ctx;
}

/**
 * The real registry with the route kind's `route/hear` effect watched. The kind
 * runs unchanged; each call and each draw it makes is counted in `watch`, so a
 * test can count the draws hearing makes in a month when the offer kind draws
 * on the same stream.
 */
export function watchHear(watch: Watch): Registry {
  return registry().map((kind) => {
    const hear = kind.effects?.["route/hear"];
    if (kind.kind !== "route" || hear === undefined) return kind;
    return {
      ...kind,
      effects: {
        ...kind.effects,
        "route/hear": (ctx: Ctx, effect: Effect, cause: Cause) => {
          watch.calls += 1;
          return hear(counted(ctx, watch), effect, cause);
        },
      },
    };
  });
}

/** The real registry with `offer/choose` carrying out the given effects in place of the offer kind's own handler. */
export function withEffects(effects: Effect[], terms: Terms = {}): Registry {
  return registry().map((kind) =>
    kind.kind !== "offer" ? kind : { ...kind, commands: { "offer/choose": (ctx) => ctx.apply(effects, { source: "test", param: null, terms }) } },
  );
}

/** Carries out effects on the game's state through the engine's routing, as an offer choice would. */
export function applyEffects(game: Game, effects: Effect[], terms: Terms = {}): void {
  const result = stepWith(withEffects(effects, terms), game.state, { type: "offer/choose", offer: "x", choice: "y", basedOn: game.state.v }, game.world(), game.content);
  if (!result.ok) throw new Error(`The effects were rejected with ${result.code}: ${result.detail}`);
  game.state = result.state;
}

/** Sets each named quality to the middle, so a lift or a fall is never lost to a bound. */
export function middling(game: Game, qualities: readonly Id<"quality">[]): void {
  applyEffects(
    game,
    qualities.map((quality): Effect => ({ type: "quality/add", quality, amount: 50 - (game.state.quality[quality] ?? 0) })),
  );
}

/** The route's report lines from carrying out effects as an offer's take would. */
export function linesOf(game: Game, effects: Effect[], terms: Terms): ReportLine[] {
  const result = stepWith(withEffects(effects, terms), game.state, { type: "offer/choose", offer: "x", choice: "y", basedOn: game.state.v }, game.world(), game.content);
  if (!result.ok) throw new Error(`The effects were rejected with ${result.code}: ${result.detail}`);
  return result.lines.filter((line) => line.key.startsWith("line.route."));
}

/** Months pass until the application's decision month has come and gone. */
export function pastDecision(game: Game, route: Id<"route">): void {
  const decision = routeOf(game, route).visa!.decisionMonth;
  while (game.state.turn.month < decision) game.endTurn();
}
