// The archetypes on the real content (prologue.md R-PROLOGUE-010): each preset is played on
// fresh lives over many seeds, the draws falling as they fall. Every step has the archetype's answer, sent while it
// is allowed; where a draw has shut it, the open answer that suits the archetype goes instead, and no card shows.
import { content } from "@japacity/content";
import { allMet } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { chargedLivingContent, newGame } from "../testing/fixtures";
import { start } from "../../../../../packages/sim/src/testing/play";
import { say } from "../words/text";
import { earlyStops, nextStepOf, ownWayOf, sixteenPath } from "../words/sixteen";
import { agePointsCount, ARCHETYPES, type Archetype, archetypeOf, doorAnswer, handoverKind, lowestYear, ownSteps, presetAnswer, withAge } from "./archetypes";

const PROLOGUE = "scenario.prologue";
const FIRST_CHAPTER = "chapter.find-your-feet";
const SEEDS = 60;

interface Played {
  /** Steps reached that the archetype names no answer for: a card a new life would have to show. */
  unnamed: string[];
  /** Steps whose preset answers a draw had shut, so the open answer that suits the archetype went instead. */
  shut: string[];
  /** True when every step the archetype chose was answered as it chose: the draws kept the life on its path. */
  kept: boolean;
  game: ReturnType<typeof newGame>;
}

/** `on`: the content the life is played on; the shipped content unless a test needs the living charged (decision 0035). */
function play(archetype: Archetype, seed: string, on: typeof content = content): Played {
  const game = on === content ? newGame(PROLOGUE, seed) : start({ scenario: PROLOGUE, seed, content: on });
  const unnamed: string[] = [];
  const shut: string[] = [];
  const sent = new Set<string>();
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    if (archetype.preset[prologue.step] === undefined) unnamed.push(prologue.step);
    const answer = doorAnswer(archetype, prologue);
    if (answer === null) throw new Error(`No open answer at ${prologue.step}.`);
    if (presetAnswer(archetype, prologue) === null) shut.push(prologue.step);
    else sent.add(prologue.step);
    game.accept({ type: "prologue/choose", step: prologue.step, answer });
  }
  const kept = ownSteps(archetype).every((step) => sent.has(step));
  return { unnamed, shut, kept, game };
}

// Plays every archetype over many seeds; under a busy machine (several checks at once) it has passed its five seconds
// and failed three builders on 11 Oct 2026, so it carries its own longer limit.
describe("the archetypes", { timeout: 20_000 }, () => {
  test("[R-PROLOGUE-010] [R-PROLOGUE-012] given every archetype, then there are seven, the child of the water last, and every step and answer it names exists on its step", () => {
    expect(ARCHETYPES.map((archetype) => archetype.id)).toEqual(["developer", "nurse", "accountant", "writer", "trader", "shop-worker", "water"]);
    for (const archetype of ARCHETYPES) {
      for (const [step, answers] of Object.entries(archetype.preset)) {
        const entry = content.prologue[step];
        expect(entry, `${archetype.id}: ${step}`).toBeDefined();
        for (const answer of answers) expect(entry?.answers.some((candidate) => candidate.id === answer), `${archetype.id}: ${step}.${answer}`).toBe(true);
      }
      for (const [step, answer] of Object.entries(archetype.leaning)) expect(content.prologue[step]?.answers.some((candidate) => candidate.id === answer), `${archetype.id}: ${step}.${answer}`).toBe(true);
      for (const route of archetype.routes) expect(content.route[route], `${archetype.id}: ${route}`).toBeDefined();
    }
  });

  test("[R-PROLOGUE-010] given every archetype on fresh lives over many seeds, when its preset is played, then no card is left to show: on its path every step has the archetype's answer, sent while it is allowed, and off it (a draw that shut the trade, a second retake) the open answer that suits it goes", () => {
    const wrong: string[] = [];
    const shutSeen = new Map<string, number>();
    for (const archetype of ARCHETYPES) {
      // The table's open cards are none: the exam, the strike, the send-off and the home are preset too.
      for (const step of ["exam", "strike", "friend", "home"]) if ((archetype.preset[step] ?? []).length === 0) wrong.push(`${archetype.id}: no answer for ${step}`);
      for (let at = 0; at < SEEDS; at += 1) {
        const { unnamed, shut, kept, game } = play(archetype, `${archetype.id}-${String(at)}`);
        if (game.state.prologue.open) wrong.push(`${archetype.id} ${String(at)}: still open`);
        if (kept) for (const step of unnamed) wrong.push(`${archetype.id} ${String(at)}: ${step} has no answer on the path`);
        // One retake only: the second retake card offers only work. The trader's master is shut to a city family that can pay for school.
        const named = shut.filter((step) => !unnamed.includes(step));
        for (const step of named) if (step !== "retake" && !(archetype.id === "trader" && step === "after-school")) wrong.push(`${archetype.id} ${String(at)}: ${step} shut`);
        shutSeen.set(archetype.id, (shutSeen.get(archetype.id) ?? 0) + named.filter((step) => step !== "retake").length);
      }
    }
    expect(wrong).toEqual([]);
    expect(Object.fromEntries(shutSeen)).toEqual({ developer: 0, nurse: 0, accountant: 0, writer: 0, trader: shutSeen.get("trader"), "shop-worker": 0, water: 0 });
    expect(shutSeen.get("trader")).toBeGreaterThan(0);
  });

  test("[R-PROLOGUE-010] given every archetype over many seeds, when its prologue closes on its own path, then the life is in the first chapter and at least one route the tile names is heard or can be heard", () => {
    const wrong: string[] = [];
    const keptBy = new Map<string, number>();
    for (const archetype of ARCHETYPES) {
      for (let at = 0; at < SEEDS; at += 1) {
        const played = play(archetype, `${archetype.id}-${String(at)}`);
        const { game } = played;
        const view = game.view();
        if (view.chapter.current !== FIRST_CHAPTER) wrong.push(`${archetype.id} ${String(at)}: in ${String(view.chapter.current)}`);
        // Two failed exams send a degree life to the shop counter, and a city family keeps a child from the master: off the path, the tile's promise is not the life's.
        if (!played.kept) continue;
        keptBy.set(archetype.id, (keptBy.get(archetype.id) ?? 0) + 1);
        const read = { state: game.state, world: game.world(), content };
        const reached = archetype.routes.filter((id) => {
          const state = view.routes.find((route) => route.id === id)?.state;
          return (state !== undefined && state !== "unknown") || allMet(read, content.route[id]?.hearIf ?? []);
        });
        if (reached.length === 0) wrong.push(`${archetype.id} ${String(at)}: no route`);
      }
    }
    expect(wrong).toEqual([]);
    // Most lives stay on their path.
    for (const archetype of ARCHETYPES) expect(keptBy.get(archetype.id) ?? 0).toBeGreaterThan(SEEDS / 3);
  });

  test("[R-PROLOGUE-010] given every archetype but the shop worker and the trader, then a route of its own effort is reached without the road", () => {
    const ownEffort = new Set(["route.uk-masters", "route.uk-skilled", "route.uk-talent", "route.uk-care", "route.canada-points", "route.gulf-contract", "route.road"]);
    expect(ARCHETYPES.filter((archetype) => !archetype.routes.some((route) => ownEffort.has(route))).map((archetype) => archetype.id)).toEqual([]);
    const wrong: string[] = [];
    for (const archetype of ARCHETYPES.filter((one) => one.id !== "trader" && one.id !== "shop-worker")) {
      for (let at = 0; at < 10; at += 1) {
        const { game, kept } = play(archetype, `${archetype.id}-${String(at)}`);
        if (!kept) continue;
        const read = { state: game.state, world: game.world(), content };
        const reached = archetype.routes.filter((id) => id !== "route.road" && allMet(read, content.route[id]?.hearIf ?? []));
        if (reached.length === 0) wrong.push(`${archetype.id} ${String(at)}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

/** The figure a requirement on `quality` in `requirements` asks for. */
function barOf(requirements: readonly { type: string; quality?: string; value?: number }[], quality: string): number {
  const bar = requirements.find((requirement) => requirement.type === "quality/min" && requirement.quality === quality)?.value;
  if (bar === undefined) throw new Error(`No bar on ${quality}.`);
  return bar;
}

function qualityOf(game: ReturnType<typeof newGame>, id: string): number {
  return game.view().qualities.find((quality) => quality.id === id)?.value ?? 0;
}

function routeState(game: ReturnType<typeof newGame>, id: string): string {
  return game.view().routes.find((route) => route.id === id)?.state ?? "unknown";
}

const NURSE_JOB = "activity.job-nurse";
const CLINIC = "place.tb-clinic";
const HUNT = "activity.job-hunt";
const GRADE = "quality.edu-grade";
/** The master's own bar on the degree's grade: second class lower (route.md). */
const GRADE_BAR = barOf((content.route["route.uk-masters"]?.checklist ?? []).map((item) => item.requirement), GRADE);

describe("every tile's promise is kept by the life it starts", () => {
  test("[R-PROLOGUE-010] [R-GUIDE-016] given the nurse over many seeds on her own path, when she hands over, then care is at the staff nurse's bar with the licence held, the job is staged at the clinic and the hunt can ask for it there, and her first step is that job at the clinic; her first meetup tells of care work", () => {
    const nurse = archetypeOf("nurse")!;
    const bar = barOf(content.activity[NURSE_JOB]?.requires ?? [], "quality.care");
    expect(content.place[CLINIC]?.stages).toContain(NURSE_JOB);
    const wrong: string[] = [];
    for (let at = 0; at < SEEDS; at += 1) {
      const { game, kept } = play(nurse, `nurse-${String(at)}`);
      if (!kept) continue;
      const view = game.view();
      if (qualityOf(game, "quality.care") < bar) wrong.push(`${String(at)}: care ${String(qualityOf(game, "quality.care"))}`);
      if (!view.documents.some((paper) => paper.id === "document.nursing-licence" && paper.state === "held")) wrong.push(`${String(at)}: no licence`);
      if (!(view.activities.find((option) => option.id === HUNT)?.params ?? []).includes(NURSE_JOB)) wrong.push(`${String(at)}: the hunt cannot ask for the job`);
      if (nextStepOf(view) !== "job") wrong.push(`${String(at)}: first step ${String(nextStepOf(view))}`);
      const way = ownWayOf(view);
      if (way?.place !== CLINIC || way.activity !== NURSE_JOB) wrong.push(`${String(at)}: the first step's way is ${JSON.stringify(way)}`);
      // The clinic's stop is open to her in the first chapter, though the chapter opens it only at decision day.
      if (!earlyStops(view).includes(CLINIC)) wrong.push(`${String(at)}: the clinic is not open to her yet`);
      game.endTurn([{ activity: "activity.meetup", param: null }]);
      if (routeState(game, "route.uk-care") === "unknown") wrong.push(`${String(at)}: the first meetup told nothing of care`);
    }
    expect(wrong).toEqual([]);
  });

  test("[R-PROLOGUE-010] [R-GUIDE-016] given the developer over many seeds on his own path, when he hands over, then the grade is at the master's bar and tech hears of the talent route at his first meetup, or it was heard at the send-off", () => {
    const developer = archetypeOf("developer")!;
    expect(developer.preset["hustle"]).toEqual(["focus"]);
    expect(developer.preset["side-skill"]).toEqual(["code"]);
    const wrong: string[] = [];
    for (let at = 0; at < SEEDS; at += 1) {
      const { game, kept } = play(developer, `developer-${String(at)}`);
      if (!kept) continue;
      if (qualityOf(game, GRADE) < GRADE_BAR) wrong.push(`${String(at)}: grade ${String(qualityOf(game, GRADE))}`);
      game.endTurn([{ activity: "activity.meetup", param: null }]);
      if (routeState(game, "route.uk-talent") === "unknown") wrong.push(`${String(at)}: no talent route after the first meetup`);
    }
    expect(wrong).toEqual([]);
  });

  test("[R-PROLOGUE-010] [R-CHAPTER-009] [R-ROAD-012] given the trader and the shop worker over many seeds, when each hands over having heard of the Gulf from the drivers, then the first step is asking around at the motor park, the ask looks the Gulf into there, and the road's pitches can reach him at home", () => {
    const wrong: string[] = [];
    for (const archetype of ARCHETYPES.filter((one) => one.id === "trader" || one.id === "shop-worker")) {
      expect(archetype.preset["friend"]).toEqual(["drivers"]);
      for (let at = 0; at < SEEDS; at += 1) {
        const { game, kept } = play(archetype, `${archetype.id}-${String(at)}`);
        // A city family keeps a child from the master, and the child goes to university instead.
        if (!kept) continue;
        const view = game.view();
        if (routeState(game, "route.gulf-contract") !== "heard") wrong.push(`${archetype.id} ${String(at)}: the Gulf is ${routeState(game, "route.gulf-contract")} at the handover`);
        if (nextStepOf(view) !== "known") wrong.push(`${archetype.id} ${String(at)}: first step ${String(nextStepOf(view))}`);
        const way = ownWayOf(view);
        if (way?.place !== "place.ojuelegba" || way.thing !== "motor-park" || way.activity !== "activity.ask-around") wrong.push(`${archetype.id} ${String(at)}: the first step's way is ${JSON.stringify(way)}`);
        // The man at the park asks only someone who has asked around there this month: judged once he has, before the month ends.
        game.accept({ type: "activity/now", activity: "activity.ask-around", param: null });
        const read = { state: game.state, world: game.world(), content };
        if (!allMet(read, content.offer["offer.road-park"]?.when ?? [])) wrong.push(`${archetype.id} ${String(at)}: the road's pitch cannot reach him`);
        if (routeState(game, "route.gulf-contract") !== "known") wrong.push(`${archetype.id} ${String(at)}: the Gulf is ${routeState(game, "route.gulf-contract")} after asking around`);
        game.endTurn([]);
        if (ownWayOf(game.view())?.thing === "motor-park") wrong.push(`${archetype.id} ${String(at)}: still sent to the motor park`);
      }
    }
    expect(wrong).toEqual([]);
  });

  test("[R-PROLOGUE-010] [R-GUIDE-016] given the accountant and the writer over many seeds on their own path, when each plays a first meetup, then the master's is heard of, a route their tiles name", () => {
    const wrong: string[] = [];
    for (const archetype of ARCHETYPES.filter((one) => one.id === "accountant" || one.id === "writer")) {
      expect(archetype.routes).toContain("route.uk-masters");
      for (let at = 0; at < SEEDS; at += 1) {
        const { game, kept } = play(archetype, `${archetype.id}-${String(at)}`);
        if (!kept) continue;
        game.endTurn([{ activity: "activity.meetup", param: null }]);
        if (routeState(game, "route.uk-masters") === "unknown") wrong.push(`${archetype.id} ${String(at)}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe("the tiles' words", () => {
  test("[R-PROLOGUE-004] [R-PROLOGUE-010] given every archetype over many seeds, when its prologue closes at its own age, then its tile names the age it hands over from, in years, and every one of its lives starts in that year", () => {
    const said: Record<string, number> = {};
    const found: Record<string, number[]> = {};
    for (const archetype of ARCHETYPES) {
      const years = Array.from({ length: SEEDS }, (_, at) => Math.floor(qualityOf(play(archetype, `${archetype.id}-${String(at)}`).game, "quality.age-months") / 12));
      found[archetype.id] = [...new Set(years)];
      said[archetype.id] = Number(/at (\d+)/.exec(say(`prologue.archetype.${archetype.id}.opens`))?.[1] ?? -1);
    }
    expect(found).toEqual(Object.fromEntries(Object.entries(said).map(([id, year]) => [id, [year]])));
    // The sheet above the tiles names no one age for all of them.
    expect(say("ui.door.path.hint")).not.toMatch(/\d/);
  });

  test("[R-PROLOGUE-010] given the trader's and the shop worker's tiles, then the road is said as the road through the desert, never bare", () => {
    for (const id of ["trader", "shop-worker"]) {
      expect(say(`prologue.archetype.${id}.opens`)).toMatch(/the road through the desert/);
    }
  });
});

describe("the handover reads the life as lived", () => {
  test("[R-PROLOGUE-011] given lives on one draw each, as online, when the trader's tile is shut by the family and the life goes to university, then the handover says the years went another way and never names the trader; a trader's life kept says the trader", () => {
    const trader = archetypeOf("trader")!;
    const said = { kept: 0, off: 0 };
    const wrong: string[] = [];
    for (let at = 0; at < SEEDS; at += 1) {
      const { game, kept } = play(trader, `trader-${String(at)}`);
      const line = handoverKind(trader, game.view());
      if (kept) {
        said.kept += 1;
        if (line !== "The trader. Six years under a spare parts master.") wrong.push(`${String(at)}: ${line}`);
        continue;
      }
      // Shut out of the trade, most go through university. The few who then fail the exam twice end at a counter,
      // which the view cannot tell from a master's thin settlement: those still read as a trade.
      if (sixteenPath(game.view()) !== "degree") continue;
      said.off += 1;
      if (line !== say("prologue.handover.lived.degree") || line.includes(say("prologue.archetype.trader.name"))) wrong.push(`${String(at)}: ${line}`);
    }
    expect(wrong).toEqual([]);
    expect(said.kept).toBeGreaterThan(0);
    expect(said.off).toBeGreaterThan(0);
  });

  test("[R-PROLOGUE-004] [R-PROLOGUE-011] given a degree tile started at 29, whose life failed the exam twice and went to the counter, when it hands over, then it reads as work from school on, never the tile; a kept nurse says the nurse", () => {
    const wrong: string[] = [];
    let off = 0;
    for (const archetype of ARCHETYPES.filter((one) => one.id !== "trader" && one.id !== "shop-worker")) {
      for (let at = 0; at < SEEDS; at += 1) {
        // At its own year no retake is drawn (R-PROLOGUE-004): a second retake needs years of work to spare, so the
        // tile is started at the oldest year the card offers.
        const { game, kept } = play(withAge(archetype, 29 - lowestYear(archetype)), `${archetype.id}-${String(at)}`);
        const line = handoverKind(archetype, game.view());
        const tile = say(`prologue.archetype.${archetype.id}.name`);
        if (kept && !line.startsWith(`${tile}. `)) wrong.push(`${archetype.id} ${String(at)}: ${line}`);
        if (!kept) {
          off += 1;
          if (line !== say("prologue.handover.lived.trade")) wrong.push(`${archetype.id} ${String(at)}: ${line}`);
        }
      }
    }
    expect(wrong).toEqual([]);
    expect(off).toBeGreaterThan(0);
  // Plays the counter life over every degree tile and many seeds: more than the five seconds a test is given under load.
  }, 20_000);

  test("[R-PROLOGUE-011] given the words for one life and for a life as lived, then each is there, plain, with no dash", () => {
    for (const key of ["prologue.archetype.once", "prologue.handover.lived.degree", "prologue.handover.lived.capital", "prologue.handover.lived.trade"]) {
      expect(say(key)).not.toBe(key);
      expect(say(key)).not.toMatch(/[\u2013\u2014]/);
    }
  });
});

describe("the nurse's send-off", () => {
  test("[R-PROLOGUE-011] given the nurse's tile, then her send-off leaning is the nurses' crowd, so care work is heard before any page is read", () => {
    expect(ARCHETYPES.find((tile) => tile.id === "nurse")?.leaning).toEqual({ friend: "care" });
  });
});

const WATER = "water";
const MAKOKO = "place.makoko";
const MAKOKO_UPKEEP = "obligation.upkeep-makoko";
const TAKEN_IN = "offer.taken-in";
const WHERE_NEXT = "offer.where-next";
const DESK_JOB = "activity.job-customer-service";
const OPEN_SHOP = "activity.open-shop";
type Game = ReturnType<typeof newGame>;

function nairaHeld(game: Game): number {
  const { cash, bank } = game.view().pockets.NGN;
  return cash + bank;
}

/**
 * One month of a life going up: a hunt for the desk job its schooling allows until it holds it, the job taken when
 * offered, and the home's asks answered as the way up answers them (taken in by someone, then back to the water).
 * Returns true when the settlement was cleared this month.
 */
function upMonth(game: Game, hunt: boolean): boolean {
  if (game.state.turn.banked < 1) game.grant(content.tuning.turn.cap);
  // The hunt goes on while a lesser job is held (the sure first hunt may land the racks, R-GUIDE-014), as the better-job nudge tells a player.
  const slots = hunt && game.view().job.id !== DESK_JOB ? [{ activity: "activity.job-hunt" as const, param: DESK_JOB }] : [];
  const result = game.endTurn(slots);
  for (const offer of game.view().offers) {
    const pick = (choice: string) => game.accept({ type: "offer/choose", offer: offer.id, choice });
    if (offer.entry === "offer.job") pick("accept");
    if (offer.entry === TAKEN_IN) pick("someone");
    if (offer.entry === WHERE_NEXT) pick(offer.choices.find((choice) => choice.id === "makoko")?.allowed === true ? "makoko" : "family");
  }
  return result.events.some((event) => event.type === "home/evicted");
}

describe("the child of the water (R-PROLOGUE-012)", () => {
  const water = archetypeOf(WATER)!;

  test("[R-PROLOGUE-012] given the child of the water over many seeds, when its preset is played, then every life keeps its path, school then the shop counter with no master, and closes in Makoko's room at the page's rent with nothing else owed, the family house there to go back to", () => {
    expect(water.preset).toMatchObject({ subjects: ["commercial"], "after-school": ["work"], shop: ["save"], friend: ["drivers"], home: ["makoko"] });
    expect(water.preset["master"]).toBeUndefined();
    const wrong: string[] = [];
    for (let at = 0; at < SEEDS; at += 1) {
      const { game, kept, unnamed, shut } = play(water, `${WATER}-${String(at)}`);
      const view = game.view();
      if (!kept) wrong.push(`${String(at)}: off the path`);
      // No card: the send-off is its crowd's, as the table names it, and nothing a draw shut.
      if (unnamed.length > 0 || shut.length > 0) wrong.push(`${String(at)}: unnamed ${unnamed.join(",")}, shut ${shut.join(",")}`);
      if (view.home.place !== MAKOKO || view.home.moved !== null) wrong.push(`${String(at)}: home ${JSON.stringify(view.home)}`);
      // Decision 0035 (R-HOME-012): the room's bill stands at the page's rent, and the engine charges none of it as the month turns.
      if (view.home.rent?.amount !== 0) wrong.push(`${String(at)}: rent ${JSON.stringify(view.home.rent)}`);
      if (view.obligations.map((owed) => owed.entry).join(",") !== MAKOKO_UPKEEP) wrong.push(`${String(at)}: owes ${view.obligations.map((owed) => owed.entry).join(",")}`);
      if (view.obligations.some((owed) => owed.amount !== content.tuning.home.makokoUpkeep)) wrong.push(`${String(at)}: the room's bill ${JSON.stringify(view.obligations)}`);
      if (sixteenPath(view) !== "trade") wrong.push(`${String(at)}: ${String(sixteenPath(view))}`);
      if (handoverKind(water, view) !== `${say("prologue.archetype.water.name")}. ${say("prologue.archetype.water.was")}.`) wrong.push(`${String(at)}: ${handoverKind(water, view)}`);
    }
    expect(wrong).toEqual([]);
  });

  test("[R-PROLOGUE-012] given the child of the water and the shop worker on the same seeds, when each rests six months, then the room on the water has saved more every time, by Makoko's rent against the family's upkeep", () => {
    const shopWorker = archetypeOf("shop-worker")!;
    const wrong: string[] = [];
    for (let at = 0; at < 30; at += 1) {
      const seed = `save-${String(at)}`;
      // Decision 0035 (R-HOME-012): with the living lived by hand neither home charges anything as the month turns, so the
      // saving the page promises is tested with the living charged whole, as the simulation's relief tests charge it.
      const lives = [play(water, seed, chargedLivingContent).game, play(shopWorker, seed, chargedLivingContent).game];
      for (const game of lives) for (let month = 0; month < 6; month += 1) upMonth(game, false);
      const [onWater, atHome] = lives.map(nairaHeld) as [number, number];
      if (onWater <= atHome) wrong.push(`${seed}: ${String(onWater)} against ${String(atHome)}`);
    }
    expect(wrong).toEqual([]);
  });

  test("[R-PROLOGUE-012] given the child of the water at its handover, then work is at hand: the hunt can ask for the desk job its schooling allows in the first month; and working it from the room, a shop's capital for a stall at the market comes within the first year, where from the family house it does not", () => {
    const shopWorker = archetypeOf("shop-worker")!;
    const reached = { water: 0, home: 0 };
    const wrong: string[] = [];
    const lives = 12;
    for (let at = 0; at < lives; at += 1) {
      const seed = `up-${String(at)}`;
      for (const [who, archetype] of [["water", water], ["home", shopWorker]] as const) {
        // Decision 0035 (R-HOME-012): the capital the room saves against the family house is tested with the living charged
        // whole, as the simulation's relief tests charge it; lived by hand, neither home charges anything.
        const { game } = play(archetype, seed, chargedLivingContent);
        if (!(game.view().activities.find((option) => option.id === "activity.job-hunt")?.params ?? []).includes(DESK_JOB)) wrong.push(`${seed} ${who}: the hunt cannot ask for the desk job`);
        for (let month = 0; month < 12; month += 1) upMonth(game, true);
        if (game.view().activities.some((option) => option.id === OPEN_SHOP && option.allowed)) reached[who] += 1;
      }
    }
    expect(wrong).toEqual([]);
    expect(reached).toEqual({ water: lives, home: 0 });
  });

  test("[R-PROLOGUE-012] [R-CHAPTER-009] [R-ROAD-012] given the child of the water over many seeds, when it hands over having heard of the Gulf from the drivers, then the chapter's step is asking around at the motor park (the handover says the racks first while they are work at hand, R-ACTIVITY-017), the ask looks the Gulf into there, and the road's pitches can reach it at home", () => {
    expect(water.routes).toEqual(["route.gulf-contract", "route.road"]);
    expect(water.preset["friend"]).toEqual(["drivers"]);
    const wrong: string[] = [];
    let kept = 0;
    for (let at = 0; at < SEEDS; at += 1) {
      const played = play(water, `${water.id}-${String(at)}`);
      if (!played.kept) continue;
      kept += 1;
      const { game } = played;
      const view = game.view();
      const way = ownWayOf(view);
      if (nextStepOf(view) !== "known" || way?.thing !== "motor-park" || way.activity !== "activity.ask-around") wrong.push(`${String(at)}: the first step's way is ${JSON.stringify(way)}`);
      game.accept({ type: "activity/now", activity: "activity.ask-around", param: null });
      const read = { state: game.state, world: game.world(), content };
      if (!allMet(read, content.offer["offer.road-park"]?.when ?? [])) wrong.push(`${String(at)}: the road's pitch cannot reach it`);
      if (routeState(game, "route.gulf-contract") !== "known") wrong.push(`${String(at)}: the Gulf is ${routeState(game, "route.gulf-contract")} after asking around`);
    }
    expect(wrong).toEqual([]);
    expect(kept).toBe(SEEDS);
  });

  test("[R-PROLOGUE-012] [R-HOME-003] [R-HOME-004] given the child of the water over many lives, when the settlement is cleared, then the same month a relative in Lagos takes it in with no rent, and it is never left with nowhere to go", () => {
    let cleared = 0;
    const wrong: string[] = [];
    for (let at = 0; at < 20; at += 1) {
      const { game } = play(water, `cleared-${String(at)}`);
      for (let month = 0; month < 24; month += 1) {
        if (game.state.turn.banked < 1) game.grant(content.tuning.turn.cap);
        const result = game.endTurn([]);
        if (!result.events.some((event) => event.type === "home/evicted")) continue;
        cleared += 1;
        const when = game.view().month;
        const offer = game.view().offers.find((open) => open.entry === TAKEN_IN);
        if (offer?.choices.find((choice) => choice.id === "someone")?.allowed !== true) wrong.push(`${String(at)} month ${String(when)}: no one to take it in`);
        if (offer === undefined) break;
        game.accept({ type: "offer/choose", offer: offer.id, choice: "someone" });
        const home = game.view().home;
        if (home.guest === null || home.guest.host !== "someone" || home.rent !== null || game.view().month !== when) wrong.push(`${String(at)} month ${String(when)}: ${JSON.stringify(home)}`);
        break;
      }
    }
    expect(wrong).toEqual([]);
    expect(cleared).toBeGreaterThan(0);
  });
});

describe("the child of the water's words (R-PROLOGUE-012)", () => {
  test("[R-PROLOGUE-012] given the child of the water's tile, then it says where the life starts and names its way out, the road said as the road through the desert", () => {
    expect(say("prologue.archetype.water.was")).toMatch(/Makoko/);
    expect(say("prologue.archetype.water.opens")).toMatch(/^Opens: a Gulf contract, the road through the desert/);
    for (const key of ["name", "was", "opens", "nudge.job", "nudge.heard", "nudge.shop"]) {
      const words = say(`prologue.archetype.water.${key}`);
      expect(words).not.toBe(`prologue.archetype.water.${key}`);
      expect(words).not.toMatch(/[\u2013\u2014]/);
    }
  });
});

describe("the age line at a tile's own age", () => {
  test("[R-PROLOGUE-009] given the tiles, then only those whose ways out count age in Canada's points are told how long before the points fall", () => {
    expect(ARCHETYPES.filter((archetype) => agePointsCount(archetype)).map((archetype) => archetype.id)).toEqual(["nurse", "accountant", "writer"]);
  });
});
