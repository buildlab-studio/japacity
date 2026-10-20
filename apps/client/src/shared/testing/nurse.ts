// A nurse's life played through `step` on the real content, for the nudge's, the stops' and Japa's tests: the
// tile's nurse from school, or the ready nurse; the asks answered the
// quiet way, the staff nurse's job taken, the care page read, the council asked, a sponsor looked for.
import { content } from "@japacity/content";
import type { Id, PlayerView, SlotPick, World } from "@japacity/sim";
import { standInWorlds } from "@japacity/sim";
import { start, type Game } from "@japacity/sim/testing";

import { answersInOrder, archetypeOf, presetAnswer } from "../frontdoor/archetypes";

export const CARE: Id<"route"> = "route.uk-care";
const NURSE_JOB = "activity.job-nurse";
const HUNT: Id<"activity"> = "activity.job-hunt";
const PAGE: Id<"activity"> = "activity.look-into-route";
/** Choices that take a job or a sponsor's post: the way the nurse is played. */
const TAKE = new Set(["accept", "take"]);
const TAKEN_OFFERS = new Set(["offer.job"]);
/** The quiet answers to the family's and the street's asks: nothing spent, nothing started. */
const QUIET = ["no", "decline", "walk-on", "not-now", "ignore", "refuse", "say-no", "pass", "leave"];

const WORLD_SEED = "world-1";
const CARE_WINDOW = "var.uk-care-window" as Id<"var">;
/** A window var at 2 is open (rate.md). */
const OPEN = 2;
let walked: World[] = [];

/**
 * The stand-in world, with UK health care open to applicants from abroad from the first month when `open`: the window
 * the director opens some time in a life (route-gates:care-route-needs-verification), opened here so a test reaches the sponsor in its own months.
 */
function worldAt(open: boolean): ((tick: number) => World) | undefined {
  if (!open) return undefined;
  return (tick) => {
    if (walked.length <= tick) walked = standInWorlds(WORLD_SEED, Math.max(tick + 1, walked.length * 2, 120), content);
    const world = walked[tick];
    if (world === undefined) throw new Error(`No world at tick ${String(tick)}.`);
    return { ...world, vars: { ...world.vars, [CARE_WINDOW]: OPEN } };
  };
}

function begin(scenario: Id<"scenario">, seed: string, open: boolean): Game {
  const at = worldAt(open);
  return start({ scenario, seed, content, worldSeed: WORLD_SEED, ...(at === undefined ? {} : { worldAt: at }) });
}

/** The tile's nurse, handed over: its preset answers while allowed, else the answer that suits it. `open`: health care open from abroad. */
export function tileNurse(seed: string, open = false): Game {
  const archetype = archetypeOf("nurse");
  if (archetype === null) throw new Error("No nurse tile.");
  const game = begin("scenario.prologue", seed, open);
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    const open = presetAnswer(archetype, prologue) ?? answersInOrder(archetype, prologue.step, prologue.answers).find((answer) => answer.allowed)?.id;
    if (open === undefined) throw new Error(`No open answer at ${prologue.step}.`);
    game.accept({ type: "prologue/choose", step: prologue.step, answer: open });
  }
  return game;
}

/** The ready nurse: thirty months on the ward, the licence and the passport held. `open`: health care open from abroad. */
export function readyNurse(seed = "ready-nurse", open = false): Game {
  return begin("scenario.nurse", seed, open);
}

/** Health care heard of at the meetup: the ready nurse's first step. */
export function hearCare(game: Game, most = 6): void {
  for (let guard = 0; guard < most && (game.state.route[CARE]?.state ?? "unknown") === "unknown"; guard += 1) month(game, [{ activity: "activity.meetup", param: null }]);
  if ((game.state.route[CARE]?.state ?? "unknown") === "unknown") throw new Error("Health care was never heard of.");
}

/** Answers whatever waits: a set piece's first allowed answer, a job or a sponsor taken, every other ask the quiet way. */
export function settle(game: Game, take: (entry: string) => boolean = (entry) => TAKEN_OFFERS.has(entry) || entry.startsWith("offer.sponsor")): void {
  for (let guard = 0; guard < 30; guard += 1) {
    const view = game.view();
    const question = view.setpiece?.question ?? null;
    if (question !== null) {
      // She knows her work: the answer that scores most, from content, else the first allowed.
      const asked = view.setpiece === null ? undefined : content.setpiece[view.setpiece.entry];
      const answers = [...(asked?.questions ?? []), ...(asked?.followUps ?? [])].find((one) => one.id === question.id)?.answers ?? [];
      const best = [...answers].filter((one) => question.allowed.includes(one.id)).sort((a, b) => b.score - a.score)[0]?.id;
      const answer = best ?? question.allowed[0];
      if (answer === undefined) throw new Error(`No answer to ${question.id}.`);
      game.accept({ type: "setpiece/answer", question: question.id, answer });
      continue;
    }
    const interview = view.interview?.question ?? null;
    if (interview !== null) {
      game.accept({ type: "interview/answer", question: interview.id, option: interview.options[0]! });
      continue;
    }
    const offer = view.offers[0];
    if (offer === undefined) return;
    const allowed = offer.choices.filter((choice) => choice.allowed);
    const choice = (take(offer.entry) ? allowed.find((one) => TAKE.has(one.id)) : undefined) ?? allowed.find((one) => QUIET.includes(one.id)) ?? allowed[allowed.length - 1];
    if (choice === undefined) throw new Error(`No choice on ${offer.entry}.`);
    game.accept({ type: "offer/choose", offer: offer.id, choice: choice.id, ...(choice.pick === null ? {} : { amount: choice.pick.min }) });
  }
  throw new Error("The asks never ran out.");
}

/** One month: what waits answered, the pages filled when they run out, the month ended with its picks, what came answered. */
export function month(game: Game, slots: SlotPick[] = []): void {
  settle(game);
  if (game.state.turn.banked < 1) game.grant(24);
  game.endTurn(slots);
  settle(game);
}

/** The staff nurse's job, asked for until it is taken. */
export function hire(game: Game, months = 8): void {
  for (let guard = 0; guard < months && game.state.activity.job !== NURSE_JOB; guard += 1) month(game, [{ activity: HUNT, param: NURSE_JOB }]);
  if (game.state.activity.job !== NURSE_JOB) throw new Error("The clinic never took her.");
}

/** Health care heard of (the send-off's nurses, or the meetup) and its page read. */
export function readCare(game: Game): void {
  if ((game.state.route[CARE]?.state ?? "unknown") === "unknown") throw new Error("Health care is not heard of.");
  game.accept({ type: "activity/now", activity: PAGE, param: CARE });
}

/** Months played until `done` holds, at most `most`. */
export function until(game: Game, done: (view: PlayerView) => boolean, most: number, slots: (view: PlayerView) => SlotPick[] = () => []): PlayerView {
  for (let guard = 0; guard < most; guard += 1) {
    const view = game.view();
    if (done(view)) return view;
    month(game, slots(view));
  }
  const view = game.view();
  if (!done(view)) throw new Error(`Not there in ${String(most)} months: ${view.chapter.current ?? "no chapter"}.`);
  return view;
}
