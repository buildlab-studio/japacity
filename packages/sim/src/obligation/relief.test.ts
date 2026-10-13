// The room's basics: docs/rules/obligation.md R-OBLIGATION-014. Cooking and fetching water are two
// slot-none activities that take a share off the upkeep's next charge where the character lives,
// played through the harness on the real content.
import { content as realContent, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { bp } from "../engine/int";
import { checkInvariants } from "../engine/invariants";
import type { Accepted, ActivityEntry, BaseEvent, Content, Id } from "../engine/types";
import type { QualityEvent } from "../quality/quality.events";
import { slot } from "../route/route.journey";
import type { Game } from "../testing/play";
/** Decision 0035 lives the living by hand at home; these tests read the charge itself, so they charge it whole. */
const content: Content = { ...realContent, tuning: { ...realContent.tuning, home: { ...realContent.tuning.home, livingByHandBp: 0 } } };

import { start } from "../testing/play";
import { abroad, eventsOf, owedOf, setPounds, UPKEEP } from "./obligation.journey";

// The meal bought and cooked, at home or abroad: a meal of your own since the home's wave, the old
// cooking act's entry as it was; the family house's pot is free and tested in home/pot.test.ts.
const COOK: Id<"activity"> = "activity.cook-own";
const WATER: Id<"activity"> = "activity.fetch-water";
const DRUM: Id<"activity"> = "activity.fill-drum";
const HOME_UPKEEP: Id<"obligation"> = "obligation.upkeep";
const WELLBEING: Id<"quality"> = "quality.wellbeing";
const COOKED_LINE = "line.obligation.relief.cook-own";
const WATER_LINE = "line.obligation.relief.fetch-water";
const { room } = content.tuning;

function ada(base: Content = content): Game {
  return start({ content: base, scenario: "scenario.ada" });
}

function entry(id: Id<"activity">): ActivityEntry {
  const found = content.activity[id];
  if (found === undefined) throw new Error(`No ${id} in content.`);
  return found;
}

/** What the upkeep took this month, in its currency, under the upkeep's reason. */
function upkeepPaid(result: Accepted): number {
  return result.events
    .filter((event) => event.type === "wallet/debited" && (event as unknown as { reason: string }).reason === "upkeep")
    .reduce((sum, event) => sum + (event as unknown as { amount: number }).amount, 0);
}

/** The month played with these slots, beside the same month in a twin life with none: the upkeep each paid. */
function againstNone(slots: Id<"activity">[], prepare: (game: Game) => void = () => undefined, base: Content = content): { played: Accepted; plain: Accepted; game: Game } {
  const game = ada(base);
  const twin = ada(base);
  prepare(game);
  prepare(twin);
  return { played: game.endTurn(slots.map((id) => slot(id))), plain: twin.endTurn([]), game };
}

function reliefLines(result: Accepted): { key: string; amount: unknown }[] {
  return result.lines.filter((line) => line.key.startsWith("line.obligation.relief.")).map((line) => ({ key: line.key, amount: line.params.amount }));
}

function wellbeingFrom(result: Accepted, source: string): number[] {
  return result.events
    .filter((event): event is BaseEvent & QualityEvent => event.type === "quality/changed")
    .filter((event) => event.quality === WELLBEING && event.source === source)
    .map((event) => event.amount);
}

describe("the two activities", () => {
  test("[R-OBLIGATION-014] given the content, when cooking and water are read, then both fill no slot, cooking applies at home and abroad and water at home only, and each relieves the upkeep by its tuning share", () => {
    // Decision 0035: a meal is bought and eaten now, and repeats; it still relieves a charged upkeep by its share.
    expect(entry(COOK)).toMatchObject({ slot: "none", where: "any", when: "now", repeat: true, requires: [] });
    expect(entry(COOK).cost).toEqual([{ currency: "NGN", amount: 150000, reason: "food" }]);
    expect(entry(COOK).effects).toEqual([
      { type: "obligation/relief", obligationType: "upkeep", bp: room.cookedBp },
      { type: "quality/add", quality: "quality.belly", amount: 25 },
      { type: "quality/add", quality: WELLBEING, amount: 2 },
    ]);
    // water is bought where it is sold, so the seller's act needs a home with no yard tap; the compound fills its drum free.
    // The hostel's drum is filled free from its tap too: either room's charge open.
    const compound = {
      type: "any",
      of: [
        { type: "obligation/has", obligationType: "upkeep", obligation: "obligation.upkeep-compound" },
        { type: "obligation/has", obligationType: "rent", obligation: "obligation.upkeep-hostel" },
      ],
    };
    expect(entry(WATER)).toMatchObject({ slot: "none", where: "home", cost: [], requires: [{ type: "not", of: compound }] });
    expect(entry(WATER).effects).toEqual([
      { type: "obligation/relief", obligationType: "upkeep", bp: room.waterBp },
      { type: "quality/add", quality: "quality.energy", amount: -8 },
    ]);
    expect(entry(DRUM)).toMatchObject({ slot: "none", where: "home", cost: [], requires: [compound], effects: [] });
    // the starting figures.
    expect([room.cookedBp, room.waterBp]).toEqual([1500, 400]);
  });

  test("[R-OBLIGATION-014] given Ada at home, when the month's choices are listed, then cooking and water are both offered and allowed", () => {
    const options = ada().view().activities.filter((option) => option.id === COOK || option.id === WATER || option.id === DRUM);
    expect(options.map((option) => [option.id, option.allowed])).toEqual([
      [COOK, true],
      [WATER, true],
      [DRUM, false],
    ]);
  });
});

describe("cooking at home", () => {
  test("[R-OBLIGATION-014] [R-ACTIVITY-019] given Ada at home, when she cooks now, then it fills no slot, the relief is recorded at once on the upkeep for its next charge, and she may cook again this month (decision 0035)", () => {
    const game = ada();
    expect(entry(COOK).when).toBe("now");
    expect(entry(WATER).when).toBe("now");
    expect(entry(DRUM).when).toBe("now");
    game.accept({ type: "activity/now", activity: COOK, param: null });
    expect(owedOf(game, HOME_UPKEEP).relief).toEqual([{ source: COOK, bp: room.cookedBp }]);
    expect(game.view().activities.find((option) => option.id === COOK)).toMatchObject({ allowed: true, done: false });
    game.accept({ type: "activity/now", activity: COOK, param: null });
    expect(owedOf(game, HOME_UPKEEP).relief).toEqual([{ source: COOK, bp: room.cookedBp }]);
  });

  test("[R-OBLIGATION-014] given cooking chosen this month, when the month ends, then the upkeep's charge falls by the cooked share, the results say so in a line of its own, and a meal lifts wellbeing (decision 0035)", () => {
    const { played, plain } = againstNone([COOK]);
    const full = upkeepPaid(plain);
    const less = bp(full, room.cookedBp);
    expect(full).toBeGreaterThan(0);
    expect(upkeepPaid(played)).toBe(full - less);
    expect(reliefLines(played)).toEqual([{ key: COOKED_LINE, amount: { currency: "NGN", amount: less } }]);
    expect(reliefLines(plain)).toEqual([]);
    // A committed slot is a month of meals, three of them (R-ACTIVITY-019); the relief is taken once.
    expect(wellbeingFrom(played, COOK)).toEqual([2, 2, 2]);
    // It rides with the month: every free slot still rests.
    const rested = (result: Accepted): BaseEvent | undefined => result.events.find((event) => event.type === "activity/rested");
    expect(rested(played)).toEqual(rested(plain));
    expect(rested(played)).toBeDefined();
  });

  test("[R-OBLIGATION-014] given cooking chosen one month, when the next month is played without it, then the relief was spent by the first charge and the next is charged whole", () => {
    const { played, plain, game } = againstNone([COOK]);
    expect(upkeepPaid(played)).toBeLessThan(upkeepPaid(plain));
    expect(owedOf(game, HOME_UPKEEP).relief).toBeUndefined();
    const next = game.endTurn([]);
    expect(reliefLines(next)).toEqual([]);
    expect(eventsOf(next, "obligation/charged").every((event) => event["relief"] === undefined)).toBe(true);
  });

  test("[R-OBLIGATION-014] given cooking chosen twice in one month, when the month ends, then the share is taken once and never twice", () => {
    const { played, plain } = againstNone([COOK, COOK]);
    const full = upkeepPaid(plain);
    expect(upkeepPaid(played)).toBe(full - bp(full, room.cookedBp));
    expect(eventsOf(played, "obligation/relieved")).toHaveLength(1);
    expect(reliefLines(played)).toHaveLength(1);
  });

  test("[R-OBLIGATION-014] given cooking in two months running, when each month ends, then each month's charge falls by the share once", () => {
    const game = ada();
    const twin = ada();
    for (let month = 0; month < 2; month += 1) {
      const played = game.endTurn([slot(COOK)]);
      const full = upkeepPaid(twin.endTurn([]));
      expect(upkeepPaid(played)).toBe(full - bp(full, room.cookedBp));
    }
  });
});

describe("water at home", () => {
  test("[R-OBLIGATION-014] given water fetched and cooking chosen in one month, when it ends, then the charge falls by both shares of the whole charge and each is told as its own line", () => {
    const { played, plain } = againstNone([COOK, WATER]);
    const full = upkeepPaid(plain);
    const cooked = bp(full, room.cookedBp);
    const water = bp(full, room.waterBp);
    expect(upkeepPaid(played)).toBe(full - cooked - water);
    expect(reliefLines(played)).toEqual([
      { key: COOKED_LINE, amount: { currency: "NGN", amount: cooked } },
      { key: WATER_LINE, amount: { currency: "NGN", amount: water } },
    ]);
    expect(wellbeingFrom(played, WATER)).toEqual([]);
  });

  test("[R-OBLIGATION-014] given reliefs that would take more than the charge, when the month ends, then the charge stops at zero and the second relief takes only what was left", () => {
    const whole = (id: Id<"activity">): ActivityEntry => ({ ...entry(id), effects: [{ type: "obligation/relief", obligationType: "upkeep", bp: 8000 }] });
    const base: Content = { ...content, activity: { ...content.activity, [COOK]: whole(COOK), [WATER]: whole(WATER) } };
    const { played, plain } = againstNone([COOK, WATER], () => undefined, base);
    const full = upkeepPaid(plain);
    expect(upkeepPaid(played)).toBe(0);
    expect(reliefLines(played)).toEqual([
      { key: COOKED_LINE, amount: { currency: "NGN", amount: bp(full, 8000) } },
      { key: WATER_LINE, amount: { currency: "NGN", amount: full - bp(full, 8000) } },
    ]);
    expect(checkInvariants(played.state, base)).toEqual([]);
  });
});

describe("abroad", () => {
  test("[R-OBLIGATION-014] given a life landed in the UK, when the month's choices are listed and water is sent, then water is not offered and is refused, and cooking is", () => {
    const game = abroad(content);
    const ids = game.view().activities.map((option) => option.id);
    expect(ids).toContain(COOK);
    expect(ids).not.toContain(WATER);
    game.expectRejected({ type: "turn/end", slots: [slot(WATER)] }, "not-legal");
  });

  test("[R-OBLIGATION-014] given cooking in the room abroad, when the month ends, then the country's upkeep falls by the cooked share in pounds", () => {
    const game = abroad(content);
    const twin = abroad(content);
    for (const life of [game, twin]) setPounds(life, 1_000_000);
    const played = game.endTurn([slot(COOK)]);
    const plain = twin.endTurn([]);
    const full = upkeepPaid(plain);
    expect(full).toBe(owedOf(twin, UPKEEP).amount);
    expect(upkeepPaid(played)).toBe(full - bp(full, room.cookedBp));
    expect(reliefLines(played)).toEqual([{ key: COOKED_LINE, amount: { currency: "GBP", amount: bp(full, room.cookedBp) } }]);
  });
});

describe("the words", () => {
  test("[R-OBLIGATION-014] given the two relief lines, when their words are read, then each says what was saved in its own words", () => {
    expect(text[COOKED_LINE]).toBe("Food, cooked at home: {amount} less.");
    expect(text[WATER_LINE]).toBe("Water, fetched yourself: {amount} less.");
    expect(text[`${COOK}.name`]).toBe("Indomie and egg");
    expect(text[`${WATER}.name`]).toBe("Fetch water");
  });
});
