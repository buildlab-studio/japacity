// The japa type read from the view at the send-off (decision 0024; share:cards-due-at-set-moments,
// share:card-contents, share:card-carries-no-money): one of six labels from the way out, the months kept (decision 0024), the
// risks taken and how home was held. Read from the recorded lives and a trader's tile played into her shop.
import { content, japaTypes, text } from "@japacity/content";
import type { FlatSave, PlayerView, ReportLine, SlotPick } from "@japacity/sim";
import { qualityIn, topActivities } from "@japacity/sim";
import { lifeSaves, simulatedLifeSaves, start } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { kept, moneyLines } from "../features/turn/month.results";
import { localCurrency } from "../shared/words/wayHome";
import { newGame, recordedGame } from "../shared/testing/fixtures";
import { japaTypeOf, typeWords } from "../shared/words/japaType";

/** Every recorded life: the goldens and the simulated lives played beside them. */
const SAVES: Record<string, FlatSave> = { ...lifeSaves, ...simulatedLifeSaves };

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

/** The graduate at its send-off with its card's things done most swapped, as another life might have done them. */
function graduateDoing(topActivities: Card["topActivities"], change: Partial<PlayerView> = {}): PlayerView {
  const view = graduatePlain();
  return { ...view, ...change, card: { ...view.card!, topActivities } };
}

/**
 * The graduate at its send-off with its standing brought to the middle and its job alone as the thing done most, so no reading
 * comes before the one each test sets. Study and time with the family are counted each time they are done (decision
 * 0012), so its things done most lead with them; left as they are, they would read before the test's change.
 */
function graduatePlain(): PlayerView {
  const view = sendOff("graduate-careful");
  return { ...view, card: { ...view.card!, standing: 50, topActivities: ["activity.job-junior-developer"] } };
}

/**
 * A trader from sixteen (the prologue's tile) who opens her shop with the settlement and runs it a
 * year, with the month's other acts given. The send-off card is made from the view as it stands:
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
  const standing = qualityIn(view, "quality.standing");
  const card: Card = { kind: "send-off", chapter: "chapter.send-off", route: view.japacity.route, percent: view.japacity.percent, months: view.month, standing, topActivities: topActivities(game.state, content), name: null };
  return { ...view, card };
}

describe("the japa type, read at the send-off", () => {
  // Every recorded life replayed month by month: about two seconds alone, several times that under the full check's load.
  test("[world:month-end-results-sheet] given each recorded life, when each month closes, then the months the view counts as kept are those whose results figure, in the money of the place, was above zero", { timeout: 20_000 }, () => {
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
      // A month abroad in which only the naira at home moved (a family ask paid from home, decision 0012's arrivals) shows no
      // pounds figure and is not counted; the sheet's main figure is in the money of the place whenever money moved there.
      expect({ name, countedEarly }).toEqual({ name, countedEarly: [] });
      for (const at of otherMoney) expect(shown.find((entry) => entry.month === at)).toMatchObject({ kept: false, counted: 0 });
      expect({ name, shown }).toEqual({ name, shown: shown.map((entry) => ({ ...entry, counted: entry.kept ? 1 : 0 })) });
      expect({ name, count: game.view().keptMonths }).toEqual({ name, count: shown.filter((entry) => entry.kept).length });
    }
  });

  test("[share:cards-due-at-set-moments] given the recorded lives at their send-off, when the type is read, then the graduate and the banker are family anchors, the teacher refused once below the top of its standing the long way round, and the developer the long way round (a return)", () => {
    // Decisions 0011 and 0012: the card reads a repeat act's taps as months, so study does not lead the things done most.
    // The teacher (seed golden-teacher-567) was refused once on the way it takes and ends just under the top of its standing, with
    // the head of department's job first among the things done most: the refusal makes it the long way round, where the banker's
    // standing at the top keeps it the family anchor.
    const teacher = sendOff("teacher-borrower");
    expect(teacher.routes.find((route) => route.id === teacher.card!.route)?.refusals).toBe(1);
    expect(teacher.card!.topActivities[0]).toBe("activity.job-head-of-department");
    expect(teacher.card!.standing).toBeLessThan(content.quality["quality.standing"]!.max);
    expect(teacher.place.returns).toEqual([]);
    expect(japaTypeOf(teacher)).toBe("long-way-round");
    // The graduate (seed golden-graduate-274): its standing ends at the top, 100, so it is the family anchor before the careful
    // saver its kept months would make it, though the hunt leads the things it did most.
    const graduate = sendOff("graduate-careful");
    expect(graduate.card).toMatchObject({ months: 48, standing: 100 });
    expect(graduate.card!.topActivities[0]).toBe("activity.job-hunt");
    expect(japaTypeOf(graduate)).toBe("family-anchor");
    // The banker: the senior bank job leads its things done most, time with the family among them; its standing at the top of its
    // range makes it the family anchor before the refusal on the funds its way met first would make it the long way round.
    const banker = sendOff("banker-borrower");
    expect(banker.card!.topActivities[0]).toBe("activity.job-bank-senior");
    expect(banker.card!.topActivities).toContain("activity.family-time");
    expect(banker.card!.standing).toBe(content.quality["quality.standing"]!.max);
    expect(banker.routes.find((route) => route.id === banker.card!.route)?.refusals).toBe(1);
    expect(japaTypeOf(banker)).toBe("family-anchor");
    // The developer came home once and went again: the long way round, before anything else.
    const developer = sendOff("developer-remote");
    expect(developer.place.returns.length).toBeGreaterThan(0);
    expect(japaTypeOf(developer)).toBe("long-way-round");
  });

  test("[share:cards-due-at-set-moments] given a trader's tile played into her own shop, when the type is read at a send-off, then the shop's months kept make her the careful saver before the hustler, fewer kept make her the hustler, and the kiosk beside the shop, the lotto and the bet slip both, is one risk and not the gambler", () => {
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

  test("[share:cards-due-at-set-moments] given no send-off due, a chapter card or no card, when the type is read, then there is none", () => {
    const graduate = sendOff("graduate-careful");
    expect(japaTypeOf({ ...graduate, card: null })).toBeNull();
    expect(japaTypeOf({ ...graduate, card: { ...graduate.card!, kind: "chapter" } })).toBeNull();
    const game = recordedGame("graduate-careful");
    game.endTurn();
    expect(japaTypeOf(game.view())).toBeNull();
  });

  test("[share:card-contents] given the graduate's send-off with one thing changed at a time, when the type is read, then each of the six types is reached by its own reason", () => {
    const graduate = graduatePlain();
    // A return in the record and still going: the long way round, before anything else.
    expect(japaTypeOf({ ...graduate, place: { ...graduate.place, returns: [{ month: 6, shape: "broke", country: "country.uk" }] } })).toBe("long-way-round");
    // The way taken refused once before it was granted.
    expect(japaTypeOf({ ...graduate, routes: graduate.routes.map((route) => (route.id === graduate.card!.route ? { ...route, refusals: 1 } : route)) })).toBe("long-way-round");
    // A refusal on another way is not the way taken. The graduate's recorded life is never refused (decision 0013), so the
    // refusal is set on another way here.
    expect(graduate.card!.route).not.toBe("route.uk-talent");
    expect(japaTypeOf({ ...graduate, routes: graduate.routes.map((route) => (route.id === "route.uk-talent" ? { ...route, refusals: 1 } : route)) })).not.toBe("long-way-round");
    // Home at its proudest: standing at the top of its range, or the top band with time given to family.
    expect(japaTypeOf({ ...graduate, card: { ...graduate.card!, standing: content.quality["quality.standing"]!.max } })).toBe("family-anchor");
    const standing = content.quality["quality.standing"]!;
    // The lowest standing in the top of the four bands the screen says (text:bands-not-figures).
    const topBand = standing.min + Math.ceil((3 * (standing.max - standing.min + 1)) / 4);
    expect(japaTypeOf({ ...graduate, card: { ...graduate.card!, standing: topBand, topActivities: ["activity.family-time", "activity.job-junior-developer"] } })).toBe("family-anchor");
    expect(japaTypeOf({ ...graduate, card: { ...graduate.card!, standing: topBand - 1, topActivities: ["activity.family-time", "activity.job-junior-developer"] } })).not.toBe("family-anchor");
    expect(japaTypeOf({ ...graduateDoing(["activity.family-time", "activity.job-junior-developer"]), card: { ...graduate.card!, topActivities: ["activity.family-time"], standing: 50 } })).not.toBe("family-anchor");
    // Two risks: the kiosk and an agent paid. One alone is not enough.
    expect(japaTypeOf(graduateDoing(["activity.play-lotto", "activity.see-agent-office"]))).toBe("gambler");
    expect(japaTypeOf(graduateDoing(["activity.play-lotto", "activity.job-junior-developer"]))).not.toBe("gambler");
    // Study first.
    expect(japaTypeOf(graduateDoing(["activity.learn-tech", "activity.job-junior-developer"]))).toBe("night-reader");
    expect(japaTypeOf(graduateDoing(["activity.job-junior-developer", "activity.study-english"]))).toBe("night-reader");
    // The graduate as it went, plain: its recorded life kept two thirds of its months and more, and none of the
    // readings before holds: the careful saver. One month under two thirds is the hustler, below.
    expect(graduate.keptMonths * 3).toBeGreaterThanOrEqual(graduate.card!.months * 2);
    expect(japaTypeOf(graduate)).toBe("careful-saver");
    // Two thirds of the months played kept: the careful saver, at the edge and not one month under it.
    const twoThirds = Math.ceil((graduate.card!.months * 2) / 3);
    expect(japaTypeOf({ ...graduate, keptMonths: twoThirds })).toBe("careful-saver");
    expect(japaTypeOf({ ...graduate, keptMonths: twoThirds - 1 })).toBe("hustler");
    // The careful saver comes before the hustler: a side job held or side work done most does not undo it.
    expect(japaTypeOf({ ...graduateDoing(["activity.job-junior-developer", "activity.side-gig"]), keptMonths: twoThirds, job: { ...graduate.job, side: "activity.weekend-tutoring" } })).toBe("careful-saver");
    // And after the readings that come first: every month kept is still the night reader who studied first.
    expect(japaTypeOf({ ...graduateDoing(["activity.learn-tech", "activity.job-junior-developer"]), keptMonths: graduate.card!.months })).toBe("night-reader");
  });


  test("[share:card-carries-no-money] given every type, when its words are read, then it is a name and a line, never a figure", () => {
    for (const type of japaTypes) {
      const words = typeWords(type);
      expect(words).toEqual({ name: text[`share.type.${type}.name`], line: text[`share.type.${type}.line`] });
      expect(`${words.name} ${words.line}`).not.toMatch(/\d/);
    }
  });
});
