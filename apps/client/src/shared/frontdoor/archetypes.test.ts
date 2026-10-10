// The archetypes on the real content (prologue.md R-PROLOGUE-010): each preset is played on fresh lives
// over many seeds, the draws falling as they fall. A preset answer is sent while it is allowed; any other
// card shows, and the player takes the answer that suits the archetype, or the first open one.
import { content } from "@japacity/content";
import { allMet } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame } from "../testing/fixtures";
import { say } from "../words/text";
import { earlyStops, nextStepOf, ownWayOf, sixteenPath } from "../words/sixteen";
import { answersInOrder, ARCHETYPES, type Archetype, archetypeOf, handoverKind, presetAnswer } from "./archetypes";

const PROLOGUE = "scenario.prologue";
const FIRST_CHAPTER = "chapter.find-your-feet";
const SEEDS = 60;

/** The steps every life passes the same way, which are no archetype's own choice. */
const THROUGH = new Set(["draw", "university", "strike-drag", "graduation", "settlement"]);

interface Played {
  /** Every card the player saw, in order. */
  shown: string[];
  /** Cards shown because the preset's answer was shut, not because the archetype left them open. */
  shut: string[];
  /** True when every step the archetype chose was answered as it chose: the draws kept the life on its path. */
  kept: boolean;
  game: ReturnType<typeof newGame>;
}

function play(archetype: Archetype, seed: string): Played {
  const game = newGame(PROLOGUE, seed);
  const shown: string[] = [];
  const shut: string[] = [];
  const sent = new Set<string>();
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    const preset = presetAnswer(archetype, prologue);
    if (preset !== null) {
      game.accept({ type: "prologue/choose", step: prologue.step, answer: preset });
      sent.add(prologue.step);
      continue;
    }
    shown.push(prologue.step);
    if ((archetype.preset[prologue.step] ?? []).length > 0) shut.push(prologue.step);
    const open = answersInOrder(archetype, prologue.step, prologue.answers).find((answer) => answer.allowed);
    if (open === undefined) throw new Error(`No open answer at ${prologue.step}.`);
    game.accept({ type: "prologue/choose", step: prologue.step, answer: open.id });
  }
  const kept = Object.keys(archetype.preset).every((step) => THROUGH.has(step) || sent.has(step));
  return { shown, shut, kept, game };
}

describe("the archetypes", () => {
  test("[R-PROLOGUE-010] given every archetype, then there are six, and every step and answer it names exists on its step", () => {
    expect(ARCHETYPES.map((archetype) => archetype.id)).toEqual(["developer", "nurse", "accountant", "writer", "trader", "shop-worker"]);
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

  test("[R-PROLOGUE-010] given every archetype on fresh lives over many seeds, when its preset is played, then each preset answer is sent while it is allowed, and only a card the archetype leaves open or one whose preset answer is shut shows", () => {
    const wrong: string[] = [];
    const shutSeen = new Map<string, number>();
    for (const archetype of ARCHETYPES) {
      for (let at = 0; at < SEEDS; at += 1) {
        const { shown, shut, kept, game } = play(archetype, `${archetype.id}-${String(at)}`);
        if (game.state.prologue.open) wrong.push(`${archetype.id} ${String(at)}: still open`);
        shutSeen.set(archetype.id, (shutSeen.get(archetype.id) ?? 0) + shut.length);
        for (const step of shown) if (archetype.preset[step] !== undefined && !shut.includes(step)) wrong.push(`${archetype.id} ${String(at)}: ${step} showed`);
        // On its own path, the draw, the subjects, the course and the service are never a card.
        const never = kept ? ["draw", "subjects", "course", "service", "strike-drag", "graduation", "settlement"] : [];
        for (const step of never) if (shown.includes(step)) wrong.push(`${archetype.id} ${String(at)}: ${step} showed on the path`);
      }
    }
    expect(wrong).toEqual([]);
    // A degree preset is always allowed; the trader's master is shut to a city family that can pay for school.
    expect(Object.fromEntries(shutSeen)).toEqual({ developer: 0, nurse: 0, accountant: 0, writer: 0, trader: shutSeen.get("trader"), "shop-worker": 0 });
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

  test("[R-PROLOGUE-010] [R-GUIDE-016] [R-ROAD-012] given the trader and the shop worker over many seeds, when each hands over, then the first step is asking around at the motor park, the first ask-around hears of the Gulf contract, and the road's pitches can reach him at home", () => {
    const wrong: string[] = [];
    for (const archetype of ARCHETYPES.filter((one) => one.id === "trader" || one.id === "shop-worker")) {
      for (let at = 0; at < SEEDS; at += 1) {
        const { game, kept } = play(archetype, `${archetype.id}-${String(at)}`);
        // A city family keeps a child from the master, and the child goes to university instead.
        if (!kept) continue;
        const view = game.view();
        if (nextStepOf(view) !== "heard") wrong.push(`${archetype.id} ${String(at)}: first step ${String(nextStepOf(view))}`);
        const way = ownWayOf(view);
        if (way?.place !== "place.ojuelegba" || way.thing !== "motor-park" || way.activity !== "activity.ask-around") wrong.push(`${archetype.id} ${String(at)}: the first step's way is ${JSON.stringify(way)}`);
        const read = { state: game.state, world: game.world(), content };
        if (!allMet(read, content.offer["offer.road-park"]?.when ?? [])) wrong.push(`${archetype.id} ${String(at)}: the road's pitch cannot reach him`);
        game.endTurn([{ activity: "activity.ask-around", param: null }]);
        if (routeState(game, "route.gulf-contract") === "unknown") wrong.push(`${archetype.id} ${String(at)}: the Gulf unheard after the first ask-around`);
        if (ownWayOf(game.view()) !== null) wrong.push(`${archetype.id} ${String(at)}: still sent to the motor park`);
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
  test("[R-PROLOGUE-010] given every archetype over many seeds, when its prologue closes, then its tile names the age it hands over at, in years, as the middle life of its seeds does", () => {
    const said: Record<string, number> = {};
    const found: Record<string, number> = {};
    for (const archetype of ARCHETYPES) {
      const months = Array.from({ length: SEEDS }, (_, at) => qualityOf(play(archetype, `${archetype.id}-${String(at)}`).game, "quality.age-months")).sort((a, b) => a - b);
      found[archetype.id] = Math.round((months[Math.floor(SEEDS / 2)] ?? 0) / 12);
      said[archetype.id] = Number(/about (\d+)/.exec(say(`prologue.archetype.${archetype.id}.opens`))?.[1] ?? -1);
    }
    expect(said).toEqual(found);
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

  test("[R-PROLOGUE-011] given a degree tile whose life failed the exam twice and went to the counter, when it hands over, then it reads as work from school on, never the tile; a kept nurse says the nurse", () => {
    const wrong: string[] = [];
    let off = 0;
    for (const archetype of ARCHETYPES.filter((one) => one.id !== "trader" && one.id !== "shop-worker")) {
      for (let at = 0; at < SEEDS; at += 1) {
        const { game, kept } = play(archetype, `${archetype.id}-${String(at)}`);
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
  });

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
