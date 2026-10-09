// The asks, on the real engine and the real content: each answer says what it
// paid for and what happened (docs/rules/world.md R-WORLD-008), the burial's slot is held the month
// its ask says (R-WORLD-007), the aunty's gift shows its risk before it is taken, and the savings
// circle is never offered to a life on its way out (R-WORLD-003).
import { content, text } from "@japacity/content";
import type { Effect, Id, ReportLine } from "@japacity/sim";
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { flownAda } from "../../../../../packages/sim/src/goal/goal.journey";
import { ALWAYS_GRANTED, offeredSeed } from "../../../../../packages/sim/src/place/place.journey";
import { answerFirst, applyEffects, readyLife, toApplied, toKnown } from "../../../../../packages/sim/src/route/route.journey";
import type { Game } from "../../../../../packages/sim/src/testing/play";
import { newGame, openOffer } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { tidyLines } from "../../shared/words/lines";
import { say, words } from "../../shared/words/text";
import { moneyLines } from "../turn/month.results";
import { OfferView } from "./OfferView";

const BURIAL: Id<"offer"> = "offer.village-burial";
const AUNTY: Id<"offer"> = "offer.relative-sends";
const AJO: Id<"offer"> = "offer.join-ajo";
const SEND_OFF: Id<"offer"> = "offer.family-send-off";
const UK: Id<"route"> = "route.uk-masters";

/** The lines of one answer as the player reads them. */
function told(lines: readonly ReportLine[]): string[] {
  return tidyLines(lines).map((line) => words(line.key, line.params));
}

/** The money lines of one answer as the results say them. */
function paid(lines: readonly ReportLine[]): string[] {
  return moneyLines(lines).map((entry) => words(entry.line.key, entry.line.params));
}

function answer(game: Game, entry: Id<"offer">, choice: string): ReportLine[] {
  const item = Object.values(game.state.offer.items).find((candidate) => candidate.entry === entry);
  if (item === undefined) throw new Error(`${entry} is not open.`);
  return game.accept({ type: "offer/choose", offer: item.id, choice }).lines;
}

/** A life at home with the family's standing high enough for the burial to come. */
function homeLife(): Game {
  const game = newGame("scenario.tunde");
  applyEffects(game, [{ type: "quality/add", quality: "quality.standing", amount: 30 }]);
  return game;
}

/** A life with the UK route known, so the aunty abroad hears of it. */
function knownLife(): Game {
  const game = newGame("scenario.tunde");
  applyEffects(game, [{ type: "route/hear", route: UK, via: "test" }]);
  toKnown(game);
  return game;
}

/** A ready life on the UK study route played to its decision month: the visa granted and home's send-off open. */
function grantedLife(): Game {
  const game = readyLife(content, { seed: offeredSeed(content), tuning: ALWAYS_GRANTED });
  toApplied(game);
  answerFirst(game);
  game.endTurn();
  return game;
}

describe("the party at home, told and named", () => {
  test("[R-WORLD-008] [R-CHAPTER-008] given the send-off answered with the party, when its lines are read, then the cost is the send-off's and the yard's line is told", () => {
    const game = grantedLife();
    const lines = answer(game, SEND_OFF, "party");
    expect(paid(lines)).toEqual([`The send-off: ${formatMoney(content.tuning.chapter.sendOffNaira, "NGN")}.`]);
    expect(told(lines)).toContain(text["offer.family-send-off.said.party"]);
  });
});

describe("the burial's slot", () => {
  test("[R-WORLD-007] [R-HEALTH-006] given the burial asked, when its answer to go is read, then it names the month the slot is held as the month the lock holds", async () => {
    const game = homeLife();
    const offer = openOffer(game, BURIAL);
    await renderWithView(<OfferView />, game.view());
    const card = screen.getByRole("heading", { name: words(`${BURIAL}.title`) }).closest("li");
    if (card === null) throw new Error("No card for the burial.");
    const held = say("ui.offer.lock", { slots: "1 slot", when: say("ui.offer.lock.next") });
    expect(within(card).getByRole("button", { name: `${text[`${BURIAL}.choice.go`]!}: ${formatMoney(6_000_000, "NGN")}, ${held}` })).toBeDefined();
    answer(game, BURIAL, "go");
    const locks = game.view().locks;
    expect(locks).toEqual([{ slots: 1, untilMonth: game.view().month, why: "burial" }]);
    // The month the lock holds is the month in hand, and the ask says so in the words the illness uses for it.
    expect(say("ui.offer.lock.next")).toBe(say("ui.offer.lock.when.one"));
    expect(words(`${BURIAL}.body`, {})).not.toContain("next month");
    expect(offer.expiresMonth).toBe(game.view().month + 1);
  });

  test("[R-WORLD-008] given the burial answered with the trip, when its lines are read, then the trip is told and its cost is the burial's", () => {
    const game = homeLife();
    openOffer(game, BURIAL);
    const lines = answer(game, BURIAL, "go");
    expect(told(lines)).toContain("You travel to the village for the burial. The whole family is there.");
    expect(paid(lines)).toEqual([`The burial: ${formatMoney(6_000_000, "NGN")}.`]);
  });

  test("[R-WORLD-007] given a lock for the burial, when its row is named, then it reads as the burial", () => {
    expect(say("ui.locks.row.burial")).toBe("At the burial");
  });
});

describe("the aunty's $500", () => {
  test("[R-WORLD-008] [R-LUCK-010] given the aunty's gift asked, when the ask shows, then it has two answers and each says its risk before it is taken", async () => {
    const game = knownLife();
    openOffer(game, AUNTY);
    await renderWithView(<OfferView />, game.view());
    const card = screen.getByRole("heading", { name: words(`${AUNTY}.title`) }).closest("li");
    if (card === null) throw new Error("No card for the aunty.");
    const buttons = within(card).getAllByRole("button").map((button) => button.textContent);
    expect(buttons).toEqual([text[`${AUNTY}.choice.thank`], text[`${AUNTY}.choice.note`]]);
    expect(text[`${AUNTY}.choice.thank`]).toContain("flagged for three months");
    expect(text[`${AUNTY}.choice.note`]).toContain("with a note");
  });

  test("[R-WORLD-008] [R-LUCK-010] given the gift taken as it comes, when its lines are read, then the $500 lands flagged and the line says what to do about it", () => {
    const game = knownLife();
    openOffer(game, AUNTY);
    const lines = answer(game, AUNTY, "thank");
    expect(game.state.wallet.lots).toContainEqual(expect.objectContaining({ currency: "USD", amount: 50_000, reason: "gift" }));
    expect(told(lines)).toContain(text[`${AUNTY}.said.thank`]);
    expect(text[`${AUNTY}.said.thank`]).toContain("Ask her for a note saying it was a gift, or wait three months before you apply.");
  });

  test("[R-WORLD-008] [R-LUCK-010] given the gift asked for through the bank with a note, when its lines are read, then the $500 lands unflagged and the line says so", () => {
    const game = knownLife();
    const before = game.state.wallet.pockets.USD.bank;
    openOffer(game, AUNTY);
    const lines = answer(game, AUNTY, "note");
    expect(game.state.wallet.pockets.USD.bank - before).toBe(50_000);
    expect(game.state.wallet.lots).toEqual([]);
    expect(lines.some((line) => line.key === "line.wallet.flagged")).toBe(false);
    expect(told(lines)).toContain(text[`${AUNTY}.said.note`]);
  });
});

describe("the savings circle and a life on its way out", () => {
  /** Standing and contacts enough for the circle to ask. */
  const liked: Effect[] = [
    { type: "quality/add", quality: "quality.standing", amount: 60 },
    { type: "quality/add", quality: "quality.network", amount: 30 },
  ];

  function circleOpens(game: Game): boolean {
    applyEffects(game, [...liked, { type: "offer/open", offer: AJO }]);
    return Object.values(game.state.offer.items).some((item) => item.entry === AJO);
  }

  test("[R-WORLD-003] given a life at home with no route granted, when the savings circle comes up, then it asks", () => {
    expect(circleOpens(newGame("scenario.tunde"))).toBe(true);
  });

  test("[R-WORLD-003] given the visa granted, when the savings circle comes up, then it does not ask: ten months of shares have no place in a life leaving", () => {
    const game = grantedLife();
    expect(game.state.route[UK]?.state).toBe("granted");
    expect(circleOpens(game)).toBe(false);
  });

  test("[R-WORLD-003] given a life that has flown, when the savings circle comes up, then it does not ask", () => {
    const game = flownAda(content);
    expect(Object.values(game.state.route).some((route) => route.state === "departed")).toBe(true);
    expect(circleOpens(game)).toBe(false);
  });
});

describe("the adviser's reading and the loan's charge", () => {
  test("[R-WORLD-008] given the adviser's reading of a route that does not fit, when its line is said, then it is her reading, with what is missing", () => {
    const said = words("line.activity.adviser-missing", { route: UK, count: 8, months: 3 });
    expect(said.startsWith("Her reading:")).toBe(true);
    expect(said).toContain("8 things are missing");
    expect(words("line.route.looked-into-advised", { route: UK })).not.toContain("Now you know what it takes");
  });

  test("[R-WORLD-008] given proof of funds held from the microfinance bank, when the month's charge is paid, then the results name it as the loan's charge", () => {
    const game = newGame("scenario.tunde");
    applyEffects(game, [
      { type: "money/add", currency: "NGN", pocket: "bank", amount: 50_000_000, reason: "gift" },
      { type: "obligation/open", obligation: "obligation.held-funds", principal: 1_000_000_000 },
    ]);
    const lines = game.endTurn().lines;
    const charge = paid(lines).filter((line) => line.includes("charge"));
    expect(charge).toHaveLength(1);
    expect(charge[0]).toMatch(/^The proof-of-funds loan's charge: ₦[\d,]+\.$/);
    expect(paid(lines).some((line) => line.startsWith("Paid for the use of the money"))).toBe(false);
  });
});
