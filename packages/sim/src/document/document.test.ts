import { fc, test } from "@fast-check/vitest";
import { content } from "@japacity/content";
import { describe, expect } from "vitest";

import { clamp, mulDiv, roundDownTo } from "../engine/int";
import { checkInvariants } from "../engine/invariants";
import type { Registry } from "../engine/kind";
import { stepWith } from "../engine/step";
import type {
  BaseEvent,
  Content,
  Ctx,
  DocumentState,
  Effect,
  Id,
  Rejection,
  ScenarioEntry,
  Tuning,
} from "../engine/types";
import { registry } from "../kinds";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { judged } from "../testing/read";
import { CAS, ENGLISH, PASSPORT, TB, TRANSCRIPT } from "../testing/ids";

const entries = content.document;
const band = content.tuning.english;

// Seeds whose first draw on a stream is known. The tests that use them also
// assert the drawn figure, so a seed that stops drawing what its name says
// fails loudly rather than testing the wrong edge.
/** First `document` draw: the shortest passport wait (1) and a transcript wait of 2. */
const SEED_SHORT = "seed-0";
/** First `document` draw: the longest passport wait (3) and the longest transcript wait (4). */
const SEED_LONG = "seed-1";
/** First `document` draw: the shortest transcript wait (1). */
const SEED_SHORT_TRANSCRIPT = "seed-2";
/** First `test` draw: one step down (-5). */
const SEED_DRAW_DOWN = "seed-4";
/** First `test` draw: even (0). */
const SEED_DRAW_EVEN = "seed-0";
/** First `test` draw: one step up (+5). */
const SEED_DRAW_UP = "seed-1";

const cause = { source: "test", param: null, terms: {} };

/** The real registry with `offer/choose` carrying out the given effects. It takes the place of the offer kind's own `offer/choose`. */
function withCommandEffects(effects: Effect[]): Registry {
  return registry().map((kind) =>
    kind.kind !== "offer"
      ? kind
      : {
          ...kind,
          commands: { "offer/choose": (ctx: Ctx): BaseEvent[] | Rejection => ctx.apply(effects, cause) },
        },
  );
}

/** The real registry with the activity kind's `slots` phase carrying out the given effects, as a slot activity would. */
function withSlotEffects(effects: Effect[], probe?: (ctx: Ctx) => void): Registry {
  return registry().map((kind) =>
    kind.kind !== "activity"
      ? kind
      : {
          ...kind,
          phases: {
            ...kind.phases,
            slots: (ctx: Ctx): BaseEvent[] => {
              probe?.(ctx);
              return ctx.apply(effects, cause);
            },
          },
        },
  );
}

interface LifeOptions {
  scenario?: Id<"scenario">;
  seed?: string;
  english?: number;
  documents?: ScenarioEntry["documents"];
  tuning?: Partial<Tuning["english"]>;
}

/** The real content, with the chosen life's English, papers or band numbers changed where a test needs it. */
function contentFor(options: LifeOptions): Content {
  const id = options.scenario ?? "scenario.graduate";
  const life = content.scenario[id];
  if (life === undefined) throw new Error(`No scenario ${id}.`);
  const qualities = options.english === undefined ? life.qualities : { ...life.qualities, "quality.english": options.english };
  const documents = options.documents ?? life.documents;
  return {
    ...content,
    scenario: { ...content.scenario, [id]: { ...life, qualities, documents } },
    tuning: { ...content.tuning, english: { ...content.tuning.english, ...options.tuning } },
  };
}

function life(options: LifeOptions = {}): Game {
  return start({ content: contentFor(options), scenario: options.scenario ?? "scenario.graduate", seed: options.seed ?? SEED_SHORT });
}

/** Carries out effects through a command, outside any turn. */
function applyNow(game: Game, effects: Effect[]) {
  const result = stepWith(
    withCommandEffects(effects),
    game.state,
    { type: "offer/choose", offer: "test", choice: "test", basedOn: game.state.v },
    game.world(),
    game.content,
  );
  if (!result.ok) throw new Error(`Rejected with ${result.code}: ${result.detail}`);
  game.state = result.state;
  return result;
}

/** Ends a turn whose slots phase carries out the given effects. */
function endTurnWith(game: Game, effects: Effect[], probe?: (ctx: Ctx) => void) {
  const result = stepWith(
    withSlotEffects(effects, probe),
    game.state,
    { type: "turn/end", slots: [], basedOn: game.state.v },
    game.world(),
    game.content,
  );
  if (!result.ok) throw new Error(`Rejected with ${result.code}: ${result.detail}`);
  game.state = result.state;
  game.tick += 1;
  return result;
}

function endTurns(game: Game, count: number): void {
  for (let i = 0; i < count; i += 1) game.endTurn();
}

function paper(game: Game, id: Id<"document">): DocumentState | undefined {
  return game.state.document[id];
}

function held(game: Game, document: Id<"document">, min?: number): boolean {
  return judged(game, min === undefined ? { type: "document/held", document } : { type: "document/held", document, min }).met;
}

function pending(game: Game, document: Id<"document">): boolean {
  return judged(game, { type: "document/pending", document }).met;
}

function absent(game: Game, document: Id<"document">): boolean {
  return judged(game, { type: "document/absent", document }).met;
}

const request = (document: Id<"document">): Effect => ({ type: "document/request", document });
const grant = (document: Id<"document">): Effect => ({ type: "document/grant", document });
const voidIt = (document: Id<"document">): Effect => ({ type: "document/void", document });

/** The band an English level gives on a given seed, from a request in month 0 to the issue a month later. */
function bandFor(english: number, seed: string, tuning?: Partial<Tuning["english"]>): number | null {
  const game = tuning === undefined ? life({ english, seed }) : life({ english, seed, tuning });
  applyNow(game, [request(ENGLISH)]);
  game.endTurn();
  return paper(game, ENGLISH)?.value ?? null;
}

describe("requesting a document", () => {
  test("[document:request-starts-pending] given no passport, when one is requested, then it is pending and due after a wait between the entry's two figures", () => {
    const game = life();
    game.endTurn();
    const result = applyNow(game, [request(PASSPORT)]);
    const doc = paper(game, PASSPORT);
    expect(doc?.state).toBe("pending");
    expect(doc?.expiresMonth).toBeNull();
    expect(doc?.value).toBeNull();
    const [min, max] = entries[PASSPORT]!.wait;
    expect(doc?.readyMonth).toBeGreaterThanOrEqual(1 + min);
    expect(doc?.readyMonth).toBeLessThanOrEqual(1 + max);
    expect(pending(game, PASSPORT)).toBe(true);
    expect(absent(game, PASSPORT)).toBe(false);
    expect(held(game, PASSPORT)).toBe(false);
    expect(result.lines).toEqual([
      { key: "line.document.requested", params: { document: PASSPORT, month: doc?.readyMonth ?? -1 }, tone: "plain", attention: false, counts: [] },
    ]);
  });

  test("[document:request-starts-pending] given a seed whose draw is the shortest wait, when a passport is requested, then it is due one month on and arrives then", () => {
    const game = life({ seed: SEED_SHORT });
    game.endTurn();
    applyNow(game, [request(PASSPORT)]);
    expect(entries[PASSPORT]!.wait[0]).toBe(1);
    expect(paper(game, PASSPORT)?.readyMonth).toBe(2);
    game.endTurn();
    expect(paper(game, PASSPORT)?.state).toBe("held");
  });

  test("[document:request-starts-pending] given a seed whose draw is the longest wait, when a passport is requested, then it is due three months on and not a month sooner", () => {
    const game = life({ seed: SEED_LONG });
    game.endTurn();
    applyNow(game, [request(PASSPORT)]);
    expect(entries[PASSPORT]!.wait[1]).toBe(3);
    expect(paper(game, PASSPORT)?.readyMonth).toBe(4);
    endTurns(game, 2);
    expect(game.state.turn.month).toBe(3);
    expect(paper(game, PASSPORT)?.state).toBe("pending");
    game.endTurn();
    expect(paper(game, PASSPORT)?.state).toBe("held");
  });

  test("[document:request-starts-pending] given the transcript's wait of 1 to 4, when it is requested on seeds drawing each end, then it is due 1 and 4 months on", () => {
    const short = life({ seed: SEED_SHORT_TRANSCRIPT });
    short.endTurn();
    applyNow(short, [request(TRANSCRIPT)]);
    expect(paper(short, TRANSCRIPT)?.readyMonth).toBe(1 + entries[TRANSCRIPT]!.wait[0]);
    const long = life({ seed: SEED_LONG });
    long.endTurn();
    applyNow(long, [request(TRANSCRIPT)]);
    expect(paper(long, TRANSCRIPT)?.readyMonth).toBe(1 + entries[TRANSCRIPT]!.wait[1]);
  });

  test("[document:request-starts-pending] [director:world-variables-per-route] given the strike's extra wait in the world, when the transcript is requested, then that many months are added to its wait, and nothing to the passport's", () => {
    for (const extra of [0, 4]) {
      const game = life({ seed: SEED_SHORT_TRANSCRIPT });
      game.endTurn();
      const world = game.world();
      game.world = () => ({ ...world, vars: { ...world.vars, "var.transcript-wait-extra": extra } });
      applyNow(game, [request(TRANSCRIPT), request(PASSPORT)]);
      expect(paper(game, TRANSCRIPT)?.readyMonth).toBe(1 + entries[TRANSCRIPT]!.wait[0] + extra);
    }
    const plain = life({ seed: SEED_SHORT_TRANSCRIPT });
    plain.endTurn();
    applyNow(plain, [request(TRANSCRIPT), request(PASSPORT)]);
    const stretched = life({ seed: SEED_SHORT_TRANSCRIPT });
    stretched.endTurn();
    const world = stretched.world();
    stretched.world = () => ({ ...world, vars: { ...world.vars, "var.transcript-wait-extra": 4 } });
    applyNow(stretched, [request(TRANSCRIPT), request(PASSPORT)]);
    expect(paper(stretched, PASSPORT)?.readyMonth).toBe(paper(plain, PASSPORT)?.readyMonth);
  });

  test.prop([fc.string({ minLength: 1, maxLength: 12 }), fc.constantFrom(PASSPORT, TRANSCRIPT)], { numRuns: 60 })(
    "[document:request-starts-pending] given any seed, when a document is requested, then its wait is inside the entry's range and one draw is made on the document stream",
    (seed, id) => {
      const game = life({ seed });
      game.endTurn();
      const before = game.state.draws;
      applyNow(game, [request(id)]);
      const [min, max] = entries[id]!.wait;
      const wait = (paper(game, id)?.readyMonth ?? -1) - game.state.turn.month;
      expect(wait).toBeGreaterThanOrEqual(min);
      expect(wait).toBeLessThanOrEqual(max);
      expect(game.state.draws.document).toBe((before.document ?? 0) + 1);
      expect(game.state.draws.test).toBe(before.test);
    },
  );

  test("[document:request-starts-pending] given a request, when it is carried out, then no money moves: the fee is the requesting activity's cost", () => {
    const game = life();
    const pockets = game.state.wallet.pockets;
    const result = applyNow(game, [request(PASSPORT)]);
    expect(game.state.wallet.pockets).toEqual(pockets);
    expect(result.events.map((event) => event.type)).toEqual(["document/requested", "engine/stepped"]);
  });

  test("[document:request-starts-pending] given a request from a slot, when the turn resolves, then the wait is counted from that turn's month", () => {
    const game = life({ seed: SEED_LONG });
    endTurnWith(game, [request(PASSPORT)]);
    expect(game.state.turn.month).toBe(1);
    expect(paper(game, PASSPORT)).toMatchObject({ state: "pending", readyMonth: 1 + entries[PASSPORT]!.wait[1] });
  });

  test("[document:request-starts-pending] given a request, when the view is read, then the document is listed pending with its month", () => {
    const game = life();
    applyNow(game, [request(PASSPORT)]);
    expect(game.view().documents).toEqual([
      { id: PASSPORT, state: "pending", readyMonth: paper(game, PASSPORT)?.readyMonth ?? -1, expiresMonth: null, value: null, onItsWay: paper(game, PASSPORT)?.readyMonth ?? -1 },
    ]);
  });
});

describe("issuing", () => {
  test("[document:due-document-issued] given a pending passport, when the papers phase of its month runs, then it is held from that month and expires 60 months on", () => {
    const game = life({ seed: SEED_SHORT });
    game.endTurn();
    applyNow(game, [request(PASSPORT)]);
    const result = game.endTurn();
    expect(game.state.turn.month).toBe(2);
    expect(paper(game, PASSPORT)).toEqual({ state: "held", readyMonth: null, expiresMonth: 2 + entries[PASSPORT]!.validMonths!, value: null });
    expect(entries[PASSPORT]!.validMonths).toBe(60);
    expect(held(game, PASSPORT)).toBe(true);
    expect(pending(game, PASSPORT)).toBe(false);
    expect(absent(game, PASSPORT)).toBe(false);
    expect(result.lines).toContainEqual({ key: "line.document.issued", params: { document: PASSPORT }, tone: "good", attention: false, counts: [] });
  });

  test("[document:due-document-issued] given a wait of zero, when the TB test is requested in a slot, then the papers phase of the same turn issues it", () => {
    const game = life();
    expect(entries[TB]!.wait).toEqual([0, 0]);
    const result = endTurnWith(game, [request(TB)]);
    expect(game.state.turn.month).toBe(1);
    expect(paper(game, TB)).toEqual({ state: "held", readyMonth: null, expiresMonth: 1 + entries[TB]!.validMonths!, value: null });
    expect(result.lines.map((line) => line.key)).toEqual(expect.arrayContaining(["line.document.requested", "line.document.issued"]));
  });

  test("[document:due-document-issued] given a wait of zero, when it is requested between turns, then it is due in the next month and issued by that turn's papers phase", () => {
    const game = life();
    game.endTurn();
    applyNow(game, [request(TB)]);
    expect(paper(game, TB)).toMatchObject({ state: "pending", readyMonth: 2 });
    game.endTurn();
    expect(paper(game, TB)).toEqual({ state: "held", readyMonth: null, expiresMonth: 2 + entries[TB]!.validMonths!, value: null });
  });

  test("[document:due-document-issued] given a transcript, which never expires, when it is issued, then it has no expiry month and is still held years later", () => {
    const game = life({ seed: SEED_SHORT_TRANSCRIPT });
    applyNow(game, [request(TRANSCRIPT)]);
    game.endTurn();
    expect(entries[TRANSCRIPT]!.validMonths).toBeNull();
    expect(paper(game, TRANSCRIPT)).toEqual({ state: "held", readyMonth: null, expiresMonth: null, value: null });
    endTurns(game, 20);
    expect(held(game, TRANSCRIPT)).toBe(true);
  });
});

describe("expiry", () => {
  test("[document:expired-document-not-held] given a TB certificate valid 6 months, when its expiry month comes, then it is held the month before and expired on the month", () => {
    const game = life();
    endTurnWith(game, [request(TB)]);
    const expires = 1 + entries[TB]!.validMonths!;
    expect(paper(game, TB)?.expiresMonth).toBe(expires);
    endTurns(game, expires - 2);
    expect(game.state.turn.month).toBe(expires - 1);
    expect(held(game, TB)).toBe(true);
    const result = game.endTurn();
    expect(game.state.turn.month).toBe(expires);
    expect(paper(game, TB)?.state).toBe("expired");
    expect(held(game, TB)).toBe(false);
    expect(absent(game, TB)).toBe(true);
    expect(result.lines).toContainEqual({ key: "line.document.expired", params: { document: TB }, tone: "bad", attention: false, counts: [] });
  });

  test("[document:expired-document-not-held] given a passport with 22 months left at the start, when month 22 is played, then it runs out on that month", () => {
    const game = life({ scenario: "scenario.banker" });
    expect(paper(game, PASSPORT)?.expiresMonth).toBe(22);
    endTurns(game, 21);
    expect(held(game, PASSPORT)).toBe(true);
    game.endTurn();
    expect(paper(game, PASSPORT)?.state).toBe("expired");
    expect(held(game, PASSPORT)).toBe(false);
    expect(game.view().documents).toEqual([{ id: PASSPORT, state: "expired", readyMonth: paper(game, PASSPORT)?.readyMonth ?? null, expiresMonth: 22, value: null, onItsWay: null }]);
  });

  test("[document:expired-document-not-held] given a document whose expiry month has come, when a slot reads it before the papers phase, then it no longer counts as held", () => {
    const game = life({ scenario: "scenario.banker", documents: [{ document: PASSPORT, monthsLeft: 1, value: null }] });
    let seen: { held: boolean; absent: boolean } | null = null;
    endTurnWith(game, [], (ctx) => {
      seen = {
        held: ctx.check({ type: "document/held", document: PASSPORT }).met,
        absent: ctx.check({ type: "document/absent", document: PASSPORT }).met,
      };
    });
    expect(seen).toEqual({ held: false, absent: true });
    expect(paper(game, PASSPORT)?.state).toBe("expired");
  });
});

describe("one copy at a time", () => {
  test("[document:one-pending-copy] given a passport pending, when it is requested again, then nothing changes, nothing is drawn and a line says so", () => {
    const game = life();
    applyNow(game, [request(PASSPORT)]);
    const before = game.state;
    const result = applyNow(game, [request(PASSPORT)]);
    expect(game.state.document).toEqual(before.document);
    expect(game.state.draws).toEqual(before.draws);
    expect(result.lines).toEqual([
      {
        key: "line.document.already-pending",
        params: { document: PASSPORT, month: paper(game, PASSPORT)?.readyMonth ?? -1 },
        tone: "plain",
        attention: false,
        counts: [],
      },
    ]);
  });

  test("[document:one-pending-copy] given a held passport, when a new one is requested, then the old one stays in force until the new one is issued and replaces it", () => {
    const game = life({ scenario: "scenario.banker", seed: SEED_LONG });
    game.endTurn();
    applyNow(game, [request(PASSPORT)]);
    const ready = 1 + entries[PASSPORT]!.wait[1];
    expect(paper(game, PASSPORT)).toEqual({ state: "held", readyMonth: ready, expiresMonth: 22, value: null });
    expect(held(game, PASSPORT)).toBe(true);
    expect(pending(game, PASSPORT)).toBe(true);
    expect(absent(game, PASSPORT)).toBe(false);
    endTurns(game, ready - 2);
    expect(paper(game, PASSPORT)).toMatchObject({ state: "held", readyMonth: ready, expiresMonth: 22 });
    game.endTurn();
    expect(game.state.turn.month).toBe(ready);
    expect(paper(game, PASSPORT)).toEqual({ state: "held", readyMonth: null, expiresMonth: ready + entries[PASSPORT]!.validMonths!, value: null });
    expect(pending(game, PASSPORT)).toBe(false);
  });

  test("[document:paper-on-its-way] given a held passport, when a new one is requested, then the view says it is on its way with the month it is due, and once issued nothing is on its way", () => {
    const game = life({ scenario: "scenario.banker", seed: SEED_LONG });
    game.endTurn();
    const viewed = () => game.view().documents.find((doc) => doc.id === PASSPORT);
    expect(viewed()?.onItsWay).toBeNull();
    applyNow(game, [request(PASSPORT)]);
    const ready = 1 + entries[PASSPORT]!.wait[1];
    expect(viewed()).toMatchObject({ state: "held", onItsWay: ready });
    endTurns(game, ready - 1);
    expect(game.state.turn.month).toBe(ready);
    expect(viewed()).toMatchObject({ state: "held", onItsWay: null });
  });

  test("[document:paper-on-its-way] given a passport requested for the first time, then the view says it is on its way at its ready month", () => {
    const game = life();
    applyNow(game, [request(PASSPORT)]);
    const doc = game.view().documents.find((each) => each.id === PASSPORT);
    expect(doc?.state).toBe("pending");
    expect(doc?.onItsWay).toBe(doc?.readyMonth);
  });

  test("[document:one-pending-copy] given a held passport with a new one being made, when it is requested a third time, then nothing changes", () => {
    const game = life({ scenario: "scenario.banker" });
    applyNow(game, [request(PASSPORT)]);
    const before = game.state.document;
    const result = applyNow(game, [request(PASSPORT)]);
    expect(game.state.document).toEqual(before);
    expect(result.lines.map((line) => line.key)).toEqual(["line.document.already-pending"]);
  });

  test("[document:one-pending-copy] [document:expired-document-not-held] given a held passport that runs out while the new one is being made, when it runs out, then it is pending and not held", () => {
    const game = life({ scenario: "scenario.banker", seed: SEED_LONG, documents: [{ document: PASSPORT, monthsLeft: 2, value: null }] });
    game.endTurn();
    applyNow(game, [request(PASSPORT)]);
    const ready = 1 + entries[PASSPORT]!.wait[1];
    const result = game.endTurn();
    expect(paper(game, PASSPORT)).toEqual({ state: "pending", readyMonth: ready, expiresMonth: null, value: null });
    expect(held(game, PASSPORT)).toBe(false);
    expect(pending(game, PASSPORT)).toBe(true);
    expect(result.lines.map((line) => line.key)).toContain("line.document.expired");
    endTurns(game, ready - 2);
    expect(paper(game, PASSPORT)?.state).toBe("held");
  });

  test("[document:one-pending-copy] given an expired document, when it is requested, then a fresh copy is pending", () => {
    const game = life({ scenario: "scenario.banker", documents: [{ document: PASSPORT, monthsLeft: 1, value: null }] });
    game.endTurn();
    expect(paper(game, PASSPORT)?.state).toBe("expired");
    applyNow(game, [request(PASSPORT)]);
    expect(paper(game, PASSPORT)).toMatchObject({ state: "pending", expiresMonth: null, value: null });
  });
});

describe("the English band", () => {
  const draws = [
    { name: "down", seed: SEED_DRAW_DOWN, step: -1 },
    { name: "even", seed: SEED_DRAW_EVEN, step: 0 },
    { name: "up", seed: SEED_DRAW_UP, step: 1 },
  ] as const;

  // The page: English 60 gives 6.0 on an even draw, 72 gives 6.5, 86 gives 7.0.
  const levels = [
    { english: 60, even: 60 },
    { english: 72, even: 65 },
    { english: 86, even: 70 },
  ] as const;

  test.each(levels.flatMap((level) => draws.map((draw) => ({ ...level, ...draw }))))(
    "[document:english-test-band-value] given English $english and a draw $name, when the result is issued, then the band is $even moved by the draw",
    ({ english, even, seed, step }) => {
      expect(bandFor(english, seed)).toBe(even + step * 5);
    },
  );

  test("[document:english-test-band-value] given the result is issued, when the line is read, then it carries the band and asks for attention", () => {
    const game = life({ english: 72, seed: SEED_DRAW_EVEN });
    applyNow(game, [request(ENGLISH)]);
    const result = game.endTurn();
    expect(paper(game, ENGLISH)).toEqual({ state: "held", readyMonth: null, expiresMonth: 1 + entries[ENGLISH]!.validMonths!, value: 65 });
    expect(result.lines).toContainEqual({ key: "line.document.issued-band", params: { document: ENGLISH, band: 65 }, tone: "good", attention: true, counts: [] });
    expect(game.state.draws.test).toBe(1);
  });

  test("[document:english-test-band-value] given English 0 and a draw down, when the result is issued, then the band is kept at the lowest, 40", () => {
    expect(bandFor(0, SEED_DRAW_DOWN)).toBe(band.min);
    expect(bandFor(0, SEED_DRAW_EVEN)).toBe(band.min);
    expect(band.min).toBe(40);
  });

  test("[document:english-test-band-value] given a band that would pass the highest, when the result is issued, then it is kept at 90", () => {
    // The real numbers top out at 80 for English 100, so the base is raised to reach the ceiling.
    expect(bandFor(100, SEED_DRAW_UP)).toBe(80);
    const raised = { base: 60 };
    expect(bandFor(100, SEED_DRAW_DOWN, raised)).toBe(band.max);
    expect(bandFor(100, SEED_DRAW_EVEN, raised)).toBe(band.max);
    expect(bandFor(100, SEED_DRAW_UP, raised)).toBe(band.max);
    expect(bandFor(86, SEED_DRAW_DOWN, raised)).toBe(85);
    expect(band.max).toBe(90);
  });

  test.prop([fc.integer({ min: 0, max: 100 }), fc.string({ minLength: 1, maxLength: 12 })], { numRuns: 40 })(
    "[document:english-test-band-value] given any English and any seed, when the result is issued, then the band is a multiple of 5 within one step of the even band and between 40 and 90",
    (english, seed) => {
      const value = bandFor(english, seed) ?? -1;
      const even = clamp(roundDownTo(band.base + mulDiv(band.perHundred, english, 100), 5), band.min, band.max);
      expect(roundDownTo(value, 5)).toBe(value);
      expect(value).toBeGreaterThanOrEqual(band.min);
      expect(value).toBeLessThanOrEqual(band.max);
      expect(Math.abs(value - even)).toBeLessThanOrEqual(5);
    },
  );

  test("[document:english-test-band-value] given a result held, when document/held asks for a minimum, then the value is compared and given as have and need", () => {
    const game = life({ english: 60, seed: SEED_DRAW_EVEN });
    applyNow(game, [request(ENGLISH)]);
    game.endTurn();
    expect(judged(game, { type: "document/held", document: ENGLISH, min: 60 })).toEqual({ met: true, have: 60, need: 60 });
    expect(judged(game, { type: "document/held", document: ENGLISH, min: 65 })).toEqual({ met: false, have: 60, need: 65 });
    expect(judged(game, { type: "document/held", document: PASSPORT, min: 60 })).toEqual({ met: false, have: 0, need: 60 });
  });

  test("[document:english-test-band-value] given a document with no result, when it is issued, then it has no value", () => {
    const game = life({ seed: SEED_SHORT });
    applyNow(game, [request(PASSPORT)]);
    game.endTurn();
    expect(paper(game, PASSPORT)?.value).toBeNull();
    expect(game.state.draws.test).toBeUndefined();
  });
});

describe("granting and voiding", () => {
  test("[document:grant-and-void-commands] given no confirmation, when it is granted, then it is held at once, for good, with no wait drawn", () => {
    const game = life();
    game.endTurn();
    const result = applyNow(game, [grant(CAS)]);
    expect(paper(game, CAS)).toEqual({ state: "held", readyMonth: null, expiresMonth: null, value: null });
    expect(held(game, CAS)).toBe(true);
    expect(game.state.draws.document).toBeUndefined();
    expect(result.lines).toEqual([{ key: "line.document.issued", params: { document: CAS }, tone: "good", attention: false, counts: [] }]);
  });

  test("[document:grant-and-void-commands] given a passport, when it is granted, then its validity runs from this month", () => {
    const game = life();
    endTurns(game, 3);
    applyNow(game, [grant(PASSPORT)]);
    expect(paper(game, PASSPORT)).toEqual({ state: "held", readyMonth: null, expiresMonth: 3 + entries[PASSPORT]!.validMonths!, value: null });
  });

  test("[document:grant-and-void-commands] [document:english-test-band-value] given the English test, when it is granted, then its band is set at once", () => {
    const game = life({ english: 86, seed: SEED_DRAW_UP });
    applyNow(game, [grant(ENGLISH)]);
    expect(paper(game, ENGLISH)?.value).toBe(75);
  });

  test("[document:grant-and-void-commands] given a pending passport, when it is granted, then the copy being made is the one issued", () => {
    const game = life({ seed: SEED_LONG });
    applyNow(game, [request(PASSPORT)]);
    applyNow(game, [grant(PASSPORT)]);
    expect(paper(game, PASSPORT)).toEqual({ state: "held", readyMonth: null, expiresMonth: entries[PASSPORT]!.validMonths, value: null });
    expect(pending(game, PASSPORT)).toBe(false);
  });

  test("[document:grant-and-void-commands] given a held confirmation, when it is voided, then it is gone from the state and the view", () => {
    const game = life();
    applyNow(game, [grant(CAS)]);
    const result = applyNow(game, [voidIt(CAS)]);
    expect(paper(game, CAS)).toBeUndefined();
    expect(absent(game, CAS)).toBe(true);
    expect(held(game, CAS)).toBe(false);
    expect(game.view().documents).toEqual([]);
    expect(result.lines).toEqual([{ key: "line.document.voided", params: { document: CAS }, tone: "bad", attention: false, counts: [] }]);
  });

  test("[document:grant-and-void-commands] given a pending passport, when it is voided, then it is gone and never issued", () => {
    const game = life({ seed: SEED_SHORT });
    applyNow(game, [request(PASSPORT)]);
    applyNow(game, [voidIt(PASSPORT)]);
    expect(paper(game, PASSPORT)).toBeUndefined();
    endTurns(game, 4);
    expect(paper(game, PASSPORT)).toBeUndefined();
    expect(absent(game, PASSPORT)).toBe(true);
  });

  test("[document:grant-and-void-commands] given no confirmation, when it is voided, then nothing happens", () => {
    const game = life();
    const result = applyNow(game, [voidIt(CAS)]);
    expect(result.events.map((event) => event.type)).toEqual(["engine/stepped"]);
    expect(result.lines).toEqual([]);
  });
});

describe("what always holds", () => {
  test("[document:request-starts-pending] [document:due-document-issued] [document:english-test-band-value] given papers requested, issued, expired and voided, when the invariants are checked, then nothing is wrong", () => {
    const game = life({ scenario: "scenario.banker", documents: [{ document: PASSPORT, monthsLeft: 2, value: null }] });
    applyNow(game, [request(TRANSCRIPT), request(ENGLISH), grant(CAS)]);
    endTurnWith(game, [request(TB)]);
    expect(checkInvariants(game.state, game.content)).toEqual([]);
    endTurns(game, 7);
    applyNow(game, [voidIt(CAS)]);
    expect(checkInvariants(game.state, game.content)).toEqual([]);
  });

  test("[document:request-starts-pending] [document:due-document-issued] [document:english-test-band-value] given a broken document slice, when the invariants are checked, then each break is named", () => {
    const game = life();
    const broken = {
      ...game.state,
      document: {
        "document.nothing": { state: "held", readyMonth: null, expiresMonth: null, value: null },
        [PASSPORT]: { state: "pending", readyMonth: null, expiresMonth: null, value: null },
        [TB]: { state: "held", readyMonth: null, expiresMonth: null, value: null },
        [TRANSCRIPT]: { state: "held", readyMonth: null, expiresMonth: null, value: 50 },
      } satisfies Record<string, DocumentState>,
    };
    const problems = checkInvariants(broken, game.content);
    expect(problems).toHaveLength(4);
    expect(problems.join(" ")).toMatch(/document\.nothing/);
    expect(problems.join(" ")).toMatch(/document\.passport/);
    expect(problems.join(" ")).toMatch(/document\.tb-certificate/);
    expect(problems.join(" ")).toMatch(/document\.transcript/);
  });
});
