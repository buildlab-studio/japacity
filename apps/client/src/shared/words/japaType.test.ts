// The japa type read from the view at the send-off (decision 0018; docs/rules/share.md R-SHARE-001,
// R-SHARE-004, R-SHARE-005): one of six labels from the way out, the months kept (decision 0021), the
// risks taken and how home was held. Read from the recorded lives and a trader's tile played into her shop.
import { content, japaTypes, text } from "@japacity/content";
import type { FlatSave, PlayerView, ReportLine, SlotPick } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { topActivities } from "../../../../../packages/sim/src/chapter/chapter.card";
import { lifeSaves } from "../../../../../packages/sim/src/goldens/lives.data";
import { newLifeSaves } from "../../../../../packages/sim/src/sweep/lives.data";
import { start } from "../../../../../packages/sim/src/testing/play";
import { kept, localCurrency, moneyLines } from "../../features/turn/month.results";
import { newGame, recordedGame } from "../testing/fixtures";
import { japaTypeOf, typeWords } from "./japaType";

/** Every recorded life: the blessed ones and those recorded since, not yet blessed. */
const SAVES: Record<string, FlatSave> = { ...lifeSaves, ...newLifeSaves };

/** A recorded life replayed to its end, from either list. */
function replayed(name: string): ReturnType<typeof start> {
  const save = SAVES[name];
  if (save === undefined) throw new Error(`No recorded life ${name}.`);
  const game = start({ scenario: save.scenario, seed: save.seed, worldSeed: save.worldSeed, content });
  for (const { command, tick, sender } of save.commands) {
    game.tick = tick;
    game.accept(command, sender);
  }
  return game;
}

type Card = NonNullable<PlayerView["card"]>;

function sendOff(name: string): PlayerView {
  const view = replayed(name).view();
  if (view.card?.kind !== "send-off") throw new Error(`${name}'s recorded life does not end at the send-off.`);
  return view;
}

/** Ada at her send-off with her card's things done most swapped, as another life might have done them. */
function adaDoing(topActivities: Card["topActivities"], change: Partial<PlayerView> = {}): PlayerView {
  const view = adaPlain();
  return { ...view, ...change, card: { ...view.card!, topActivities } };
}

/**
 * Ada at her send-off with her standing brought to the middle and her job alone as the thing done most, so no reading
 * comes before the one each test sets. Decision 0035: study and time with the family are counted each time they are done
 * now, so her re-recorded things done most lead with them; left as they are, they would read before the test's change.
 */
function adaPlain(): PlayerView {
  const view = sendOff("ada-careful");
  return { ...view, card: { ...view.card!, standing: 50, topActivities: ["activity.job-junior-dev"] } };
}

/**
 * A trader from sixteen (the prologue's tile) who opens her shop with the settlement and runs it a
 * year, with the month's other acts given. The send-off card is the one the engine would make now:
 * a trade's way out takes longer than a test should play.
 */
function trader(others: SlotPick["activity"][]): PlayerView {
  const game = newGame("scenario.prologue", "sixteen-0");
  for (let turn = 0; turn < 40 && game.state.prologue.open; turn += 1) {
    const prologue = game.view().prologue!;
    const allowed = prologue.answers.filter((answer) => answer.allowed).map((answer) => answer.id);
    const answer = ["apprentice", "spare-parts", "stay", "settle", "nowhere", "family-house"].find((id) => allowed.includes(id)) ?? allowed[0] ?? "";
    game.accept({ type: "prologue/choose", step: prologue.step, answer });
  }
  game.endTurn([{ activity: "activity.open-shop", param: null }]);
  for (let month = 0; month < 12; month += 1) {
    const view = game.view();
    // Each act that is open now, with the first thing it may take where it takes one.
    const picks = others.flatMap((id) => view.activities.filter((option) => option.id === id && option.allowed && option.params?.length !== 0)).slice(0, view.freeSlots);
    game.endTurn(picks.map((option) => ({ activity: option.id, param: option.params?.[0] ?? null })));
  }
  const view = game.view();
  expect(view.job.id).toBe("activity.run-shop");
  const standing = view.qualities.find((quality) => quality.id === "quality.standing")?.value ?? 0;
  const card: Card = { kind: "send-off", chapter: "chapter.send-off", route: view.japacity.route, percent: view.japacity.percent, months: view.month, standing, topActivities: topActivities(game.state, content), name: null };
  return { ...view, card };
}

describe("the japa type, read at the send-off", () => {
  test("[R-WORLD-008] given each recorded life, when each month closes, then the months the view counts as kept are those whose results figure, in the money of the place, was above zero", () => {
    for (const [name, save] of Object.entries(SAVES)) {
      const game = start({ scenario: save.scenario, seed: save.seed, worldSeed: save.worldSeed, content });
      // The month's lines as the results sheet reads them: the commands sent in the month, then the month's end.
      let month: ReportLine[] = [];
      const shown: { month: number; kept: boolean; counted: number }[] = [];
      const countedEarly: string[] = [];
      const otherMoney: number[] = [];
      for (const { command, tick, sender } of save.commands) {
        game.tick = tick;
        const before = game.view().keptMonths;
        const result = game.accept(command, sender);
        month.push(...result.lines);
        // A month not ended is never counted.
        if (command.type !== "turn/end") {
          if (game.view().keptMonths !== before) countedEarly.push(command.type);
          continue;
        }
        const view = game.view();
        const local = localCurrency(view);
        const lines = moneyLines(month);
        const nets = kept(lines);
        // The sheet's main figure is in the money of the place whenever money moved there.
        if (lines.length > 0 && !nets.some((entry) => entry.currency === local)) otherMoney.push(view.month);
        const net = nets.find((entry) => entry.currency === local)?.amount ?? 0;
        shown.push({ month: view.month, kept: lines.length > 0 && net > 0, counted: view.keptMonths - before });
        month = [];
      }
      // A month abroad in which only the naira at home moved (a family ask paid from home, decision 0037's arrivals) shows no
      // pounds figure and is not counted; the sheet's main figure is in the money of the place whenever money moved there.
      expect({ name, countedEarly }).toEqual({ name, countedEarly: [] });
      for (const at of otherMoney) expect(shown.find((entry) => entry.month === at)).toMatchObject({ kept: false, counted: 0 });
      expect({ name, shown }).toEqual({ name, shown: shown.map((entry) => ({ ...entry, counted: entry.kept ? 1 : 0 })) });
      expect({ name, count: game.view().keptMonths }).toEqual({ name, count: shown.filter((entry) => entry.kept).length });
    }
  });

  test("[R-SHARE-001] given the recorded lives at their send-off, when the type is read, then Aniekan, Ada and Tunde are family anchors and Zainab the long way round (a return)", () => {
    // Decisions 0036 and 0037: the card reads a repeat act's taps as months, so study does not
    // lead the things done most. Aniekan's refusals are on the Gulf contract, not the way he took; the junior
    // developer's job leads his things done most, and with no reading before it his standing makes him the family anchor.
    const aniekan = sendOff("aniekan-borrower");
    expect(aniekan.routes.find((route) => route.id === aniekan.card!.route)?.refusals ?? 0).toBe(0);
    expect(aniekan.card!.topActivities[0]).toBe("activity.job-junior-dev");
    expect(japaTypeOf(aniekan)).toBe("family-anchor");
    // Ada (seed golden-ada-0): her standing ends high, 91 with decision 0037's arrivals, with time with the
    // family first among the things done most, so she is the family anchor before the careful saver her kept months would make her.
    const ada = sendOff("ada-careful");
    expect(ada.card).toMatchObject({ months: 28, standing: 91 });
    expect(ada.card!.topActivities[0]).toBe("activity.family-time");
    expect(japaTypeOf(ada)).toBe("family-anchor");
    // Tunde: time with the family leads his things done most under decision 0037 (gist takes no time, so his
    // lived months hold more of it), the senior bank job behind it; no reading before the family anchor holds.
    const tunde = sendOff("tunde-borrower");
    expect(tunde.card!.topActivities[0]).toBe("activity.family-time");
    expect(tunde.card!.topActivities).toContain("activity.job-bank-senior");
    expect(japaTypeOf(tunde)).toBe("family-anchor");
    // Zainab came home once and went again: the long way round, before anything else.
    const zainab = sendOff("zainab-remote");
    expect(zainab.place.returns.length).toBeGreaterThan(0);
    expect(japaTypeOf(zainab)).toBe("long-way-round");
  });

  test("[R-SHARE-001] given a trader's tile played into her own shop, when the type is read at a send-off, then the shop's months kept make her the careful saver before the hustler, fewer kept make her the hustler, and the kiosk beside the shop, the lotto and the bet slip both, is one risk and not the gambler", () => {
    const shop = trader(["activity.ask-around", "activity.rest"]);
    const twoThirds = Math.ceil((shop.card!.months * 2) / 3);
    expect(shop.keptMonths).toBeGreaterThanOrEqual(twoThirds);
    expect(japaTypeOf(shop)).toBe("careful-saver");
    expect(japaTypeOf({ ...shop, keptMonths: twoThirds - 1 })).toBe("hustler");
    const kiosk = trader(["activity.play-lotto", "activity.bet-slip"]);
    expect(kiosk.card?.topActivities).toEqual(expect.arrayContaining(["activity.play-lotto", "activity.bet-slip"]));
    expect(japaTypeOf(kiosk)).not.toBe("gambler");
    expect(japaTypeOf({ ...kiosk, keptMonths: twoThirds - 1 })).toBe("hustler");
  });

  test("[R-SHARE-001] given no send-off due, a chapter card or no card, when the type is read, then there is none yet", () => {
    const ada = sendOff("ada-careful");
    expect(japaTypeOf({ ...ada, card: null })).toBeNull();
    expect(japaTypeOf({ ...ada, card: { ...ada.card!, kind: "chapter" } })).toBeNull();
    const game = recordedGame("ada-careful");
    game.endTurn();
    expect(japaTypeOf(game.view())).toBeNull();
  });

  test("[R-SHARE-004] given Ada's send-off with one thing changed at a time, when the type is read, then each of the six types is reached by its own reason", () => {
    const ada = adaPlain();
    // A return in the record and still going: the long way round, before anything else.
    expect(japaTypeOf({ ...ada, place: { ...ada.place, returns: [{ month: 6, shape: "broke", country: "country.uk" }] } })).toBe("long-way-round");
    // The way taken refused once before it was granted.
    expect(japaTypeOf({ ...ada, routes: ada.routes.map((route) => (route.id === ada.card!.route ? { ...route, refusals: 1 } : route)) })).toBe("long-way-round");
    // A refusal on another way is not the way taken. Decision 0035: Ada's re-recorded life is never refused, so the
    // refusal is set on another way here.
    expect(ada.card!.route).not.toBe("route.uk-talent");
    expect(japaTypeOf({ ...ada, routes: ada.routes.map((route) => (route.id === "route.uk-talent" ? { ...route, refusals: 1 } : route)) })).not.toBe("long-way-round");
    // Home at its proudest: standing at the top of its range, or the top band with time given to family.
    expect(japaTypeOf({ ...ada, card: { ...ada.card!, standing: content.quality["quality.standing"]!.max } })).toBe("family-anchor");
    const standing = content.quality["quality.standing"]!;
    // The lowest standing in the top of the four bands the screen says (R-TEXT-005).
    const topBand = standing.min + Math.ceil((3 * (standing.max - standing.min + 1)) / 4);
    expect(japaTypeOf({ ...ada, card: { ...ada.card!, standing: topBand, topActivities: ["activity.family-time", "activity.job-junior-dev"] } })).toBe("family-anchor");
    expect(japaTypeOf({ ...ada, card: { ...ada.card!, standing: topBand - 1, topActivities: ["activity.family-time", "activity.job-junior-dev"] } })).not.toBe("family-anchor");
    expect(japaTypeOf({ ...adaDoing(["activity.family-time", "activity.job-junior-dev"]), card: { ...ada.card!, topActivities: ["activity.family-time"], standing: 50 } })).not.toBe("family-anchor");
    // Two risks: the kiosk and an agent paid. One alone is not enough.
    expect(japaTypeOf(adaDoing(["activity.play-lotto", "activity.see-agent-office"]))).toBe("gambler");
    expect(japaTypeOf(adaDoing(["activity.play-lotto", "activity.job-junior-dev"]))).not.toBe("gambler");
    // Study first.
    expect(japaTypeOf(adaDoing(["activity.learn-tech", "activity.job-junior-dev"]))).toBe("night-reader");
    expect(japaTypeOf(adaDoing(["activity.job-junior-dev", "activity.study-english"]))).toBe("night-reader");
    // Ada as she went, plain: decision 0035's re-recorded life kept two thirds of her months and more, and none of the
    // readings before holds: the careful saver. One month under two thirds is the hustler, below.
    expect(ada.keptMonths * 3).toBeGreaterThanOrEqual(ada.card!.months * 2);
    expect(japaTypeOf(ada)).toBe("careful-saver");
    // Two thirds of the months played kept: the careful saver, at the edge and not one month under it.
    const twoThirds = Math.ceil((ada.card!.months * 2) / 3);
    expect(japaTypeOf({ ...ada, keptMonths: twoThirds })).toBe("careful-saver");
    expect(japaTypeOf({ ...ada, keptMonths: twoThirds - 1 })).toBe("hustler");
    // The careful saver comes before the hustler: a side job held or side work done most does not undo it.
    expect(japaTypeOf({ ...adaDoing(["activity.job-junior-dev", "activity.side-gig"]), keptMonths: twoThirds, job: { ...ada.job, side: "activity.weekend-tutoring" } })).toBe("careful-saver");
    // And after the readings that come first: every month kept is still the night reader who studied first.
    expect(japaTypeOf({ ...adaDoing(["activity.learn-tech", "activity.job-junior-dev"]), keptMonths: ada.card!.months })).toBe("night-reader");
  });


  test("[R-SHARE-005] given every type, when its words are read, then it is a name and a line, never a figure", () => {
    for (const type of japaTypes) {
      const words = typeWords(type);
      expect(words).toEqual({ name: text[`share.type.${type}.name`], line: text[`share.type.${type}.line`] });
      expect(`${words.name} ${words.line}`).not.toMatch(/\d/);
    }
  });
});
