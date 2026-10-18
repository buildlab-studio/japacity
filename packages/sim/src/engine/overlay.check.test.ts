// What an overlay may change: server:overlays-never-multiply-prices and server:public-defaults-run-the-game.
import { fc, test } from "@fast-check/vitest";
import { content } from "@japacity/content";
import { describe, expect } from "vitest";

import { ContentSchema } from "../schemas";
import { checkContent } from "./content";
import { stableJson } from "./hash";
import type { Overlay } from "./overlay";
import { applyOverlay, checkOverlay } from "./overlay";
import type { Content } from "./types";

type Path = (string | number)[];

/** Every path in the content that holds a number, lists included. */
function numberPaths(value: unknown, path: Path = []): Path[] {
  if (typeof value === "number") return [path];
  if (Array.isArray(value)) return value.flatMap((item, index) => numberPaths(item, [...path, index]));
  if (typeof value === "object" && value !== null) return Object.entries(value).flatMap(([key, inner]) => numberPaths(inner, [...path, key]));
  return [];
}

function at(value: unknown, path: Path): unknown {
  return path.reduce<unknown>((inner, key) => (inner as Record<string | number, unknown>)[key], value);
}

/**
 * An overlay that puts `value` at `path`. A list on the way is copied whole
 * from the content first, since an overlay replaces lists whole.
 */
function overlayAt(base: Content, version: string, changes: [Path, unknown][]): Overlay {
  const overlay: Record<string, unknown> = { version };
  for (const [path, value] of changes) {
    let into: Record<string | number, unknown> = overlay;
    let from: unknown = base;
    let copying = false;
    path.forEach((key, index) => {
      from = (from as Record<string | number, unknown>)[key];
      if (index === path.length - 1) {
        into[key] = value;
        return;
      }
      if (!copying && Array.isArray(from)) copying = true;
      if (copying) into[key] ??= JSON.parse(JSON.stringify(from)) as unknown;
      else into[key] ??= {};
      into = into[key] as Record<string | number, unknown>;
    });
  }
  return overlay as Overlay;
}

const NUMBERS = numberPaths(content).filter((path) => path[0] !== "version");

describe("checkOverlay: numbers only", () => {
  test("[server:public-defaults-run-the-game] [server:overlays-never-multiply-prices] given an overlay of tuning numbers and a lower fee, when checked, then it may be applied", () => {
    const overlay = overlayAt(content, "dials-ok", [
      [["tuning", "quality", "wellbeingRest"], content.tuning.quality.wellbeingRest + 2],
      [["activity", "activity.meetup", "cost", 0, "amount"], 1000],
    ]);
    expect(checkOverlay(content, overlay)).toEqual([]);
    expect(() => applyOverlay(content, overlay)).not.toThrow();
  });

  test("[server:overlays-never-multiply-prices] given an overlay with a field the content lacks, such as a price factor, when checked, then it is refused", () => {
    const overlay = { version: "dials-factor", tuning: { wallet: { priceFactorBp: 12000 } } } as unknown as Overlay;
    expect(checkOverlay(content, overlay)).toEqual([expect.stringMatching(/^tuning\.wallet\.priceFactorBp is not in the content.*factor/)]);
  });

  test("[server:public-defaults-run-the-game] given an overlay that changes a word, a flag, or the length of a list, when checked, then each is refused as a change of rule", () => {
    const meetup = content.activity["activity.meetup"]!;
    const word = { version: "dials-word", activity: { "activity.meetup": { slot: meetup.slot === "free" ? "main" : "free" } } } as Overlay;
    expect(checkOverlay(content, word)).toEqual([expect.stringMatching(/^activity\.activity\.meetup\.slot changes something that is not a number/)]);
    const flag = { version: "dials-flag", tuning: { road: { enabled: !content.tuning.road.enabled } } } as Overlay;
    expect(checkOverlay(content, flag)).toEqual([expect.stringMatching(/^tuning\.road\.enabled changes something that is not a number/)]);
    const list = { version: "dials-list", activity: { "activity.meetup": { cost: [] } } } as Overlay;
    expect(checkOverlay(content, list)).toEqual([expect.stringMatching(/^activity\.activity\.meetup\.cost changes the shape of a list/)]);
    const dropped = { version: "dials-drop", activity: { "activity.meetup": { cost: [{ currency: "NGN", amount: 1 }] } } } as unknown as Overlay;
    expect(checkOverlay(content, dropped)).toEqual([expect.stringMatching(/reason is dropped from a list/)]);
  });

  test("[server:overlays-never-multiply-prices] given an overlay that changes the ledger reason of a cost, when checked, then it is refused", () => {
    const overlay = overlayAt(content, "dials-reason", [[["activity", "activity.meetup", "cost", 0, "reason"], "gift"]]);
    expect(checkOverlay(content, overlay)).toEqual([expect.stringMatching(/^activity\.activity\.meetup\.cost\[0\]\.reason changes a ledger reason/)]);
  });

  test("[server:upgrade-state-is-pure] given an overlay that touches the rename table, when checked, then it is refused", () => {
    const overlay = { version: "dials-renames", renames: { "activity.old": "activity.meetup" } } as Overlay;
    expect(checkOverlay(content, overlay)).toEqual([expect.stringMatching(/^renames is fixed/)]);
  });

  test("[prologue:family-draw-on-first-answer] [server:overlays-never-multiply-prices] given an overlay that gives a fixed life more siblings than the prologue could draw, when checked, then it is refused by the schema before any life is built", () => {
    const [id] = Object.keys(content.scenario);
    const overlay = overlayAt(content, "dials-siblings", [[["scenario", id!, "siblings"], 300000000]]);
    expect(checkOverlay(content, overlay)).toEqual([expect.stringMatching(/does not fit the content schemas/)]);
  });

  test("[engine:numbers-read-from-content] [engine:content-checked-before-play] given an overlay whose result breaks a schema, when checked, then the reason applyOverlay gives is returned", () => {
    expect(checkOverlay(content, { version: "dials-bad", tuning: { turn: { cap: -1 } } })).toEqual([expect.stringMatching(/does not fit the content schemas/)]);
  });
});

describe("checkOverlay: new players are left alone", () => {
  test("[server:overlays-never-multiply-prices] given an overlay that raises a cost every new character can pay, when checked, then it is refused, and at its old value it may be applied", () => {
    const cost = content.activity["activity.meetup"]!.cost[0]!.amount as number;
    const up = overlayAt(content, "dials-up", [[["activity", "activity.meetup", "cost", 0, "amount"], cost + 1]]);
    expect(checkOverlay(content, up)).toEqual([`activity.activity.meetup.cost[0].amount rises from ${String(cost)} to ${String(cost + 1)}: a new character can pay it (server:overlays-never-multiply-prices).`]);
    expect(checkOverlay(content, overlayAt(content, "dials-same", [[["activity", "activity.meetup", "cost", 0, "amount"], cost]]))).toEqual([]);
  });

  test("[server:overlays-never-multiply-prices] given an overlay that raises the world variable a new character's passport fee reads, when checked, then it is refused", () => {
    const fee = content.var["var.passport-fee"]!.start;
    const overlay = overlayAt(content, "dials-passport", [[["var", "var.passport-fee", "start"], fee + 100]]);
    expect(checkOverlay(content, overlay)).toEqual([expect.stringMatching(/^var\.var\.passport-fee\.start rises .*a new character can pay the amount it sets/)]);
  });

  test("[server:overlays-never-multiply-prices] given an overlay that raises a fee only an established character meets, when checked, then it may be applied", () => {
    const fee = content.var["var.uk-care-visa-fee"]!.start;
    const overlay = overlayAt(content, "dials-drain", [[["var", "var.uk-care-visa-fee", "start"], fee + 10000]]);
    expect(checkOverlay(content, overlay)).toEqual([]);
  });

  test("[server:overlays-never-multiply-prices] given an overlay that raises a school's tuition, when checked, then it is refused, since a new character can apply", () => {
    const [id, school] = Object.entries(content.school)[0]!;
    const overlay = overlayAt(content, "dials-tuition", [[["school", id, "tuition"], school.tuition + 1]]);
    expect(checkOverlay(content, overlay)).toEqual([expect.stringMatching(new RegExp(`^school\\.${id.replace(".", "\\.")}\\.tuition rises`))]);
  });

  test("[server:overlays-never-multiply-prices] given an overlay that multiplies every price by one and a half, when checked, then it is refused for each cost a new character can pay", () => {
    const changes: [Path, unknown][] = [];
    for (const [id, entry] of Object.entries(content.activity)) {
      entry.cost.forEach((cost, index) => {
        if (typeof cost.amount === "number") changes.push([["activity", id, "cost", index, "amount"], cost.amount + (cost.amount >> 1)]);
      });
    }
    const problems = checkOverlay(content, overlayAt(content, "dials-times", changes));
    expect(problems).toEqual(expect.arrayContaining([expect.stringMatching(/^activity\.activity\.meetup\.cost\[0\]\.amount rises/)]));
    expect(problems.length).toBeGreaterThan(3);
  });

  test("[server:overlays-never-multiply-prices] given an overlay that adds money to a scenario's pockets, when checked, then it is refused, and one that takes some away may be applied", () => {
    const bank = content.scenario["scenario.ada"]!.pockets.NGN!.bank;
    const more = overlayAt(content, "dials-gift", [[["scenario", "scenario.ada", "pockets", "NGN", "bank"], bank + 1]]);
    expect(checkOverlay(content, more)).toEqual([`scenario.scenario.ada.pockets.NGN.bank rises from ${String(bank)} to ${String(bank + 1)}: an overlay adds no money to a scenario (server:overlays-never-multiply-prices).`]);
    expect(checkOverlay(content, overlayAt(content, "dials-less", [[["scenario", "scenario.ada", "pockets", "NGN", "bank"], bank - 1]]))).toEqual([]);
  });

  test("[server:overlays-never-multiply-prices] given an overlay that adds money to the prologue, the opening of a life, when checked, then it is refused", () => {
    const path = numberPaths(content.prologue, ["prologue"]).find((one) => {
      const parent = at(content, one.slice(0, -1)) as { type?: string };
      return one.at(-1) === "amount" && parent.type === "money/add";
    })!;
    expect(path).toBeDefined();
    const amount = at(content, path) as number;
    expect(checkOverlay(content, overlayAt(content, "dials-opening", [[path, amount + 1]]))).toEqual([expect.stringMatching(/adds no money to the opening of a life/)]);
  });
});

describe("checkOverlay over random overlays", () => {
  const before = stableJson(content);

  test.prop(
    [fc.array(fc.tuple(fc.integer({ min: 0, max: NUMBERS.length - 1 }), fc.integer({ min: -5, max: 300000000 })), { minLength: 1, maxLength: 6 })],
    { numRuns: 40 },
  )("[server:overlays-never-multiply-prices] [server:public-defaults-run-the-game] [engine:numbers-read-from-content] given random overlays of the content's numbers, when checked and applied, then the public defaults are untouched and still pass the content check, and an overlay the check allows applies and adds no money to any scenario", (picks) => {
    const overlay = overlayAt(
      content,
      "dials-random",
      picks.map(([index, value]): [Path, unknown] => [NUMBERS[index]!, value]),
    );
    // An overlay the check refuses is never applied, so the defaults are what plays.
    const applied = checkOverlay(content, overlay).length === 0 ? applyOverlay(content, overlay) : content;
    for (const [id, scenario] of Object.entries(applied.scenario)) {
      for (const [currency, pocket] of Object.entries(scenario.pockets)) {
        const was = content.scenario[id as keyof typeof content.scenario]!.pockets[currency as "NGN"]!;
        expect(pocket.bank).toBeLessThanOrEqual(was.bank);
        expect(pocket.cash).toBeLessThanOrEqual(was.cash);
      }
    }
    expect(stableJson(content)).toBe(before);
    expect(ContentSchema.safeParse(content).success).toBe(true);
    expect(checkContent(content)).toEqual([]);
  });

  test.prop([fc.integer({ min: 0, max: NUMBERS.length - 1 }), fc.oneof(fc.string(), fc.boolean(), fc.constant(null))], { numRuns: 40 })(
    "[server:public-defaults-run-the-game] given a random overlay that puts something other than a number where the content has a number, when checked, then it is refused",
    (index, value) => {
      expect(checkOverlay(content, overlayAt(content, "dials-junk", [[NUMBERS[index]!, value]]))).not.toEqual([]);
    },
  );
});
