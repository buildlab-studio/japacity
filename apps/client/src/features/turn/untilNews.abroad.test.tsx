// Until news abroad on the real engine and the real content (docs/rules/world.md R-WORLD-028): the
// small asks that need no answer this month do not stop the run and lapse by their `onExpire`
// (R-OFFER-005); the family's asks, a job lost, a status clock started (R-STATUS-003) and a goal
// reached do.
import { content } from "@japacity/content";
import type { Effect, Id, OfferEntry, PlayerView, ReportLine } from "@japacity/sim";
import { act, render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { stepWith } from "../../../../../packages/sim/src/engine/step";
import { withEffects } from "../../../../../packages/sim/src/route/route.journey";
import type { Game } from "../../../../../packages/sim/src/testing/play";
import { start } from "../../../../../packages/sim/src/testing/play";
import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import { abroadGame, gameAuthority, recordedSave, setPockets } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { say, words } from "../../shared/words/text";
import { CREDIT_UP, localCurrency, QUIET_PASSED, quietLine } from "./month.results";
import { Results } from "./Results";
import { turnWords } from "./turn.words";
import { quietAsk, stopsRun } from "./untilNews";

const FIND = "offer.street-find-uk" as Id<"offer">;
const OPENED = "line.offer.opened";
const RENT = "obligation.rent-room-uk";

/** Answers an open set piece (the December visit) with its first allowed answer each time. */
function answerSetpiece(game: Game): void {
  for (let question = game.view().setpiece?.question ?? null; question !== null; question = game.view().setpiece?.question ?? null) {
    game.accept({ type: "setpiece/answer", question: question.id, answer: question.allowed[0] ?? question.answers[0] ?? "" });
  }
}

/** Plays a life on with every slot resting until the month given, answering set pieces and granting months as the authority would. */
function playTo(game: Game, month: number): void {
  while (game.view().month < month) {
    answerSetpiece(game);
    const { banked } = game.view().turns;
    if (banked <= 1) game.grant(content.tuning.turn.cap - banked);
    game.endTurn();
  }
  answerSetpiece(game);
  const { banked } = game.view().turns;
  if (banked < content.tuning.turn.cap) game.grant(content.tuning.turn.cap - banked);
}

/** The pounds that fall due each month. */
function duePounds(view: PlayerView): number {
  return view.obligations.reduce((sum, owed) => sum + (content.obligation[owed.entry]?.currency === "GBP" ? owed.due : 0), 0);
}

/**
 * Ada studying in London, with pounds enough for her course, played to month 50. In this life a
 * market find opens on the street the month after (found by playing it) and the two months after it
 * bring nothing else. She is then left with the rent and the upkeep of three months.
 */
function studentAbroad(): Game {
  const game = abroadGame();
  setPockets(game, { GBP: 30_000_000, USD: 0 });
  playTo(game, 40);
  // The recording moves as content does (the goldens are re-recorded at each change), so the window is found by
  // playing: a month whose next brings the market find and nothing else that needs an answer, then two quiet months.
  for (let month = 40; month < 90; month += 1) {
    const held = { state: game.state, save: game.save, tick: game.tick };
    const ahead: ReportLine[][] = [];
    for (let step = 0; step < 3; step += 1) {
      answerSetpiece(game);
      const { banked } = game.view().turns;
      if (banked <= 1) game.grant(content.tuning.turn.cap - banked);
      ahead.push(game.endTurn().lines);
    }
    game.state = held.state;
    game.save = held.save;
    game.tick = held.tick;
    // The find and nothing else opens in the first month; the two after open nothing but, at most, the find again; nothing asks.
    const opens = (lines: readonly ReportLine[], offer: string | null) => lines.filter((line) => line.key === OPENED).map((line) => line.params["offer"]).every((id) => id === offer);
    const quiet = (lines: readonly ReportLine[]) => !lines.some((line) => line.attention && line.key !== OPENED);
    const findFirst = ahead[0]!.some((line) => line.key === OPENED && line.params["offer"] === FIND) && opens(ahead[0]!, FIND);
    // The third month is the one that stops the run (the rent not covered), whatever else it brings.
    if (findFirst && opens(ahead[1]!, null) && quiet(ahead[0]!) && quiet(ahead[1]!)) break;
    playTo(game, month + 1);
  }
  // The file below its cap, so the rent paid on time moves it (the quiet line carries the move).
  const uk = game.state.credit.byCountry["country.uk"];
  if (uk !== undefined) game.state = { ...game.state, credit: { ...game.state.credit, byCountry: { ...game.state.credit.byCountry, "country.uk": { ...uk, mark: 50 } } } };
  setPockets(game, { GBP: 3 * duePounds(game.view()) + 1_000 });
  return game;
}

/** The lines effects tell when applied as a phase or an offer's choice would apply them. */
function linesOf(game: Game, effects: Effect[]): ReportLine[] {
  const result = stepWith(withEffects(effects), game.state, { type: "offer/choose", offer: "x", choice: "y", basedOn: game.state.v }, game.world(), game.content);
  if (!result.ok) throw new Error(`The effects were rejected with ${result.code}.`);
  game.state = result.state;
  return result.lines;
}

/** A recorded life replayed until the character is working abroad. */
function workingAbroad(name: string): Game {
  const save = recordedSave(name);
  const game = start({ scenario: save.scenario, seed: save.seed, worldSeed: save.worldSeed, content });
  for (const { command, sender } of save.commands) {
    game.accept(command, sender);
    const view = game.view();
    if (view.place.where === "abroad" && view.job.id !== null) return game;
  }
  throw new Error(`${name} never works abroad.`);
}

describe("Until news abroad", () => {
  test("[R-WORLD-028] [R-OFFER-005] given a student abroad with three months of rent and a market find on the way, when Until news runs, then it passes the find, which lapses by itself, and stops at the landlord", async () => {
    const game = studentAbroad();
    const authority = gameAuthority(game);
    const store = createGameStore(authority);
    await store.getState().refresh();
    await store.getState().untilNews();
    const { quiet, lines, view } = store.getState();
    if (view === null) throw new Error("No view");
    // Three months, each its own command: two quiet, the third the one that stopped the run.
    expect(authority.sent.filter((command) => command.type === "turn/end")).toHaveLength(3);
    expect(quiet).toHaveLength(2);
    // The find opened in the first month, asking for an answer as every offer does, and the run went on.
    const opened = quiet[0]?.find((line) => line.key === OPENED && line.params["offer"] === FIND);
    expect(opened?.attention).toBe(true);
    // Its month came in the second, and it lapsed by its onExpire (R-OFFER-005).
    expect(quiet[1]?.some((line) => line.key === "line.offer.lapsed" && line.params["offer"] === FIND)).toBe(true);
    // The find that opened in the first month is gone (another may open in the month that stopped the run).
    const openedId = quiet[0]?.find((line) => line.key === OPENED && line.params["offer"] === FIND)?.params["id"];
    expect(view.offers.some((offer) => offer.id === openedId)).toBe(false);
    // The rent of the month to come is not covered: the run stops there, before it goes unpaid.
    expect(view.obligations.some((owed) => owed.entry === RENT && owed.due > 0)).toBe(true);
    expect(view.pockets.GBP.bank + view.pockets.GBP.cash).toBeLessThan(duePounds(view));
    expect(stopsRun(view, lines, 3)).toContain("dues");
    expect(localCurrency(view)).toBe("GBP");
  });

  test("[R-WORLD-028] given a quiet run abroad, then each quiet month carries the credit file's move", async () => {
    const game = studentAbroad();
    const store = createGameStore(gameAuthority(game));
    await store.getState().refresh();
    const before = store.getState().view?.credit?.mark ?? 0;
    await store.getState().untilNews();
    const { quiet, view } = store.getState();
    // The rent paid on time each month moves the file up.
    expect(view?.credit?.mark).toBeGreaterThan(before);
    expect(quiet).toHaveLength(2);
    expect(quiet.every((lines) => lines.some((line) => line.key === CREDIT_UP))).toBe(true);
  });

  test("[R-WORLD-028] given a family ask opening abroad, then the run stops for it", () => {
    const game = studentAbroad();
    const lines = linesOf(game, [{ type: "offer/open", offer: "offer.nepa-bill" }]);
    expect(lines.some((line) => line.key === OPENED && line.params["offer"] === "offer.nepa-bill")).toBe(true);
    expect(stopsRun(game.view(), lines, 1)).toContain("attention");
  });

  test("[R-WORLD-028] given a market find opening abroad, then the run goes on; at home the same line would stop it", () => {
    const game = studentAbroad();
    const lines = linesOf(game, [{ type: "offer/open", offer: FIND }]);
    const view = game.view();
    expect(stopsRun(view, lines, 1)).toEqual([]);
    expect(stopsRun({ ...view, place: { ...view.place, where: "home", country: null } }, lines, 1)).toContain("attention");
  });

  test("[R-WORLD-028] given a small ask that costs up to the cap, then it is quiet, and a penny over, it is news", () => {
    const view = studentAbroad().view();
    const find = content.offer[FIND];
    if (find === undefined) throw new Error("No market find");
    const costing = (amount: number): OfferEntry => ({
      ...find,
      choices: [{ id: "look", requires: [], pick: null, effects: [{ type: "money/take", currency: "GBP", pocket: "any", amount, reason: "social" }], fraudEffects: null }, ...find.choices.slice(1)],
    });
    const cap = content.tuning.turn.quietAskCap;
    expect(quietAsk(find, {}, view)).toBe(true);
    expect(quietAsk(costing(cap), {}, view)).toBe(true);
    expect(quietAsk(costing(cap + 1), {}, view)).toBe(false);
    // An ask content does not mark as small stays news, whatever it costs.
    expect(quietAsk({ ...find, news: true }, {}, view)).toBe(false);
    const { news, ...unmarked } = find;
    expect(news).toBe(false);
    expect(quietAsk(unmarked, {}, view)).toBe(false);
  });

  test("[R-WORLD-028] [R-STATUS-003] given a sponsored worker abroad, when the job is lost, then the run stops for the job and for the clock it starts", () => {
    const game = workingAbroad("ada-abroad");
    expect(game.view().status?.work).toBe("one-employer");
    const lines = linesOf(game, [{ type: "activity/end-job", why: "sponsor-licence" }]);
    expect(lines.some((line) => line.key === "line.activity.job-ended")).toBe(true);
    // The job lost is not a line that asks for attention: it stops the run by itself.
    expect(lines.find((line) => line.key === "line.activity.job-ended")?.attention).toBe(false);
    const stops = stopsRun(game.view(), lines, 1);
    expect(stops).toContain("job");
    expect(stops).toContain("clock");
  });

  test("[R-WORLD-028] given a goal reached abroad, then the run stops for it", () => {
    const game = abroadGame();
    setPockets(game, { GBP: 30_000_000, USD: 0 });
    let lines: readonly ReportLine[] = [];
    for (let month = 0; month < 36 && !lines.some((line) => line.key === "line.goal.done"); month += 1) {
      answerSetpiece(game);
      if (game.view().turns.banked <= 1) game.grant(content.tuning.turn.cap - game.view().turns.banked);
      lines = game.endTurn().lines;
    }
    expect(lines.some((line) => line.key === "line.goal.done")).toBe(true);
    expect(stopsRun(game.view(), lines, 1)).toContain("goal");
  });

  test("[R-WORLD-028] given that run, when the results open, then each quiet month is one line saying what moved, the find passed by and the credit up, under one heading for the month that stopped it", async () => {
    const store = createGameStore(gameAuthority(studentAbroad()));
    await store.getState().refresh();
    await store.getState().untilNews();
    // An answer's big line stands as a staged moment before the sheet (R-WORLD-008): passed here, as Carry on passes it.
    act(() => store.setState({ moments: [] }));
    const { quiet } = store.getState();
    render(
      <GameProvider store={store}>
        <Results place="Home" />
      </GameProvider>,
    );
    const rows = [...document.querySelectorAll("[data-quiet-line]")].map((row) => row.textContent);
    expect(rows).toHaveLength(2);
    const money = (lines: readonly ReportLine[]): string => {
      const { kept } = quietLine(lines, "GBP");
      if (kept === null) throw new Error("No money moved in a month of rent");
      return turnWords(kept < 0 ? "turn.results.quiet-down" : "turn.results.quiet-kept", { amount: formatMoney(Math.abs(kept), "GBP") });
    };
    // The month the find opened: the money, then the find, passed by.
    expect(quietLine(quiet[0] ?? [], "GBP").moved?.key).toBe(QUIET_PASSED);
    expect(rows[0]).toContain(`${money(quiet[0] ?? [])} ${words(QUIET_PASSED, { offer: FIND })}`);
    expect(words(QUIET_PASSED, { offer: FIND }).toLowerCase()).toContain(words("offer.street-find-uk.name").toLowerCase());
    // The month after: the money, then the one thing that moved (a story when the month had one, else the credit file's move, "Credit up.").
    expect(rows[1]).toContain(money(quiet[1] ?? []));
    expect((quiet[1] ?? []).some((line) => line.key === CREDIT_UP)).toBe(true);
    const story = quietLine(quiet[1] ?? [], "GBP").moved;
    expect(rows[1]).toContain(story === null || story === undefined ? say(CREDIT_UP) : words(story.key, story.params));
    // One heading over the month that stopped the run, not two.
    const headings = [...document.querySelectorAll("h3")].map((heading) => heading.textContent);
    expect(headings.filter((heading) => heading === turnWords("turn.results.stopped"))).toHaveLength(1);
    expect(headings.filter((heading) => heading === turnWords("turn.results.story"))).toHaveLength(0);
  });
});
