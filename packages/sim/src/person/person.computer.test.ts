// What a computer character may never do (person:computers-never-handle-money, person:computers-never-free-text): hold, take or give
// money, or say anything that is not a line or a word from content. Played on Tunde's real life and the real content.
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Content, Effect, Id, ReportLine, SlotPick } from "../engine/types";
import { applyEffects } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { TUNDE } from "../testing/ids";

const SEE: SlotPick = { activity: "activity.see-someone", param: null };
const PARTNERS = Object.values(content.person).filter((entry) => entry.role === "partner");

/** Every computer partner agrees at once and waits on nothing of its own. */
function eager(): Content {
  const copy = JSON.parse(JSON.stringify(content)) as Content;
  for (const entry of Object.values(copy.person)) {
    entry.behaviour.agreeBp = 10000;
    entry.behaviour.courtMonths = 0;
    entry.behaviour.marryAfterMonths = 0;
  }
  return copy;
}

function turn(game: Game, slots: SlotPick[]): ReportLine[] {
  if (game.state.turn.banked === 0) game.grant(1);
  return game.endTurn(slots).lines;
}

/** Tunde's life with computer siblings, every partner that will take a courting courted, and months of meetings. */
function livedWithComputers(months: number): { game: Game; lines: ReportLine[] } {
  const game = start({ scenario: TUNDE, content: eager() });
  const lines: ReportLine[] = [];
  for (const entry of PARTNERS) {
    const sent = game.send({ type: "people/court", with: entry.id });
    if (sent.ok) lines.push(...sent.lines);
  }
  for (let month = 0; month < months; month += 1) lines.push(...turn(game, [SEE]));
  return { game, lines };
}

function computerBonds(game: Game) {
  return Object.values(game.state.people.bonds).filter((bond) => bond.with.kind === "computer");
}

/** Every object in content whose type is a money effect, wherever it sits. */
function moneyEffects(value: unknown, found: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(value)) for (const item of value) moneyEffects(item, found);
  else if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record.type === "string" && /^(money\/(add|take|pay-fee)|wallet\/top-up)$/.test(record.type)) found.push(record);
    for (const inner of Object.values(record)) moneyEffects(inner, found);
  }
  return found;
}

describe("a computer character and money", () => {
  test("[person:computers-never-handle-money] given a life with computer siblings and computer partners, when every money effect is applied, then the player's wallet moves and no computer is credited or debited", () => {
    const { game } = livedWithComputers(4);
    expect(Object.values(game.state.people.slots).some((slot) => slot.state === "computer")).toBe(true);
    expect(computerBonds(game).length).toBeGreaterThan(0);
    const effects: Effect[] = [
      { type: "money/add", currency: "NGN", pocket: "bank", amount: 50_000, reason: "gift" },
      { type: "money/add", currency: "NGN", pocket: "cash", amount: 20_000, reason: "gift" },
      { type: "money/take", currency: "NGN", pocket: "any", amount: 10_000, reason: "family" },
      { type: "money/take", currency: "NGN", pocket: "transfer", amount: 10_000, reason: "wedding" },
      { type: "money/take", currency: "NGN", pocket: "cash", amount: 5_000, reason: "social" },
      { type: "money/add", currency: "GBP", pocket: "bank", amount: 50_000, reason: "gift" },
      { type: "money/pay-fee", currency: "GBP", amount: 10_000, reason: "fee-visa" },
    ];
    for (const effect of effects) {
      const people = JSON.stringify(game.state.people);
      const wallet = JSON.stringify(game.state.wallet);
      applyEffects(game, [effect]);
      expect({ effect: effect.type, walletMoved: JSON.stringify(game.state.wallet) !== wallet, peopleMoved: JSON.stringify(game.state.people) !== people }).toEqual({ effect: effect.type, walletMoved: true, peopleMoved: false });
    }
    for (const bond of computerBonds(game)) expect(bond.facts?.funds ?? null).toBeNull();
  });

  test("[person:computers-never-handle-money] given every money effect in the content, when its fields are read, then it names a currency, a pocket, an amount and the player's own reason, and never a person, a bond or a slot as the other side", () => {
    const found = moneyEffects(content);
    expect(found.length).toBeGreaterThan(50);
    const allowed = new Set(["type", "currency", "pocket", "amount", "reason", "flagged", "locked"]);
    expect(found.flatMap((effect) => Object.keys(effect).filter((key) => !allowed.has(key)))).toEqual([]);
    const people = new Set(Object.keys(content.person));
    expect(found.filter((effect) => Object.values(effect).some((value) => typeof value === "string" && (people.has(value) || value.startsWith("person."))))).toEqual([]);
  });
});

/** The text key each kind of word a people line carries is read from. */
function wordKeys(name: string, value: string): string[] {
  switch (name) {
    case "who":
      return [`${value}.name`];
    case "spot":
      return [`people.spot.${value}`];
    case "what":
      return [`people.what.${value}`, `people.call.${value}`];
    default:
      return [`${value}.name`, value];
  }
}

describe("what a computer character says", () => {
  test("[person:computers-never-free-text] given months of meetings with computer partners, when every line about them is read, then its key has words and every word it carries is a key from content, never free text", () => {
    const { game, lines } = livedWithComputers(16);
    const computers = new Set(PARTNERS.map((entry) => entry.id as string));
    const theirs = lines.filter((line) => typeof line.params.who === "string" && computers.has(line.params.who));
    expect(theirs.length).toBeGreaterThan(5);
    expect(theirs.filter((line) => text[line.key] === undefined).map((line) => line.key)).toEqual([]);
    const free = theirs.flatMap((line) =>
      Object.entries(line.params)
        .flatMap(([name, value]) => (typeof value === "string" && value !== "" ? [[name, value] as const] : []))
        .filter(([name, value]) => !wordKeys(name, value).some((key) => text[key] !== undefined))
        .map(([name, value]) => `${line.key} ${name}=${value}`),
    );
    expect(free).toEqual([]);
    // What the computers did in each moment is drawn from their entry's own lists, which content gives words.
    const drawn = computerBonds(game).flatMap((bond) => {
      const entry = content.person[bond.with.kind === "computer" ? bond.with.entry : ("" as Id<"person">)]!;
      return bond.moments.filter((moment) => moment.kind !== "wedding").map((moment) => ({ entry, moment }));
    });
    expect(drawn.length).toBeGreaterThan(5);
    expect(drawn.filter(({ entry, moment }) => ![...entry.whats, ...entry.calls].includes(moment.what)).map(({ moment }) => moment.what)).toEqual([]);
    expect(drawn.filter(({ moment }) => moment.spot !== null && text[`people.spot.${moment.spot}`] === undefined).map(({ moment }) => moment.spot)).toEqual([]);
  });

  test("[person:computers-never-free-text] given every computer character, when its lists of words are read, then each spot, what and call has words in content", () => {
    const missing = Object.values(content.person).flatMap((entry) => [
      ...entry.spots.map((spot) => `people.spot.${spot}`),
      ...entry.whats.map((what) => `people.what.${what}`),
      ...entry.calls.map((call) => `people.call.${call}`),
      `${entry.id}.name`,
    ]);
    expect(missing.length).toBeGreaterThan(Object.keys(content.person).length);
    expect(missing.filter((key) => text[key] === undefined)).toEqual([]);
  });
});
