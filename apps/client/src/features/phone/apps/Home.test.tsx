// The phone's home card (docs/rules/home.md R-HOME-007), on the real engine: where the character
// lives, the monthly charge, the move with its reason when it is shut, and a guest's host. The
// risk of the water is said once, plainly.
import { content, text } from "@japacity/content";
import { int } from "@japacity/sim";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { applyEffects } from "../../../../../../packages/sim/src/route/route.journey";
import { applyOverlay } from "../../../../../../packages/sim/src/engine/overlay";
import type { Game } from "../../../../../../packages/sim/src/testing/play";
import { start } from "../../../../../../packages/sim/src/testing/play";
import { GameProvider } from "../../../authority/GameProvider";
import { createGameStore } from "../../../authority/store";
import { gameAuthority, newGame, setPockets } from "../../../shared/testing/fixtures";
import "../../../shared/testing/render";
import { formatMoney } from "../../../shared/words/format";
import { PhoneApps } from "../PhoneApps";
import { phoneWords } from "../phone.words";

const RISK = phoneWords("phone.home.risk");
// Decision 0035 (R-HOME-012): nothing of the living is charged as the month turns at home, so the card says it is bought as you go.
const BY_HAND = phoneWords("phone.home.charge.by-hand");
const RENT = content.tuning.home.makokoUpkeep;
const ADA_UPKEEP = content.scenario["scenario.ada"]!.obligations.find((owed) => owed.obligation === "obligation.upkeep")!.amount;

async function openBills(game: Game): Promise<{ card: () => HTMLElement | null; unmount: () => void }> {
  const store = createGameStore(gameAuthority(game));
  await store.getState().refresh();
  const { unmount } = render(
    <GameProvider store={store}>
      <PhoneApps onClose={() => undefined} area="Yaba" now={() => new Date(2026, 9, 9, 12, 5)} talk={null} />
    </GameProvider>,
  );
  fireEvent.click(document.querySelector<HTMLElement>('[data-app="bills"]')!);
  return { card: () => document.querySelector<HTMLElement>("[data-home-card]"), unmount };
}

function moveButton(to: string): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(`[data-home-move="${to}"]`);
}

function times(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("the home card", () => {
  test("[R-HOME-007] given Ada at the family house with money, when Bills opens, then the card says where she lives and its charge, offers the move to Makoko with its first month's rent, and says the risk once", async () => {
    const game = newGame();
    setPockets(game, { NGN: 500_000_00 });
    const { card, unmount } = await openBills(game);
    const said = card()?.textContent ?? "";
    expect(said).toContain(phoneWords("phone.home.place.place.family-house"));
    // Decision 0035: the family's living is bought as you go, so its scenario figure is no charge on the card.
    expect(said).toContain(BY_HAND);
    expect(said).not.toContain(formatMoney(ADA_UPKEEP, "NGN"));
    expect(moveButton("place.makoko")?.disabled).toBe(false);
    expect(moveButton("place.makoko")?.textContent).toContain(formatMoney(RENT, "NGN"));
    expect(moveButton("place.family-house")).toBeNull();
    expect(times(said, RISK)).toBe(1);
    unmount();
  });

  test("[R-HOME-007] given Ada moving to Makoko from the card, when she confirms, then she lives there, the card shows Makoko's charge and the risk once, and the move back is shut for this month with its reason", async () => {
    const game = newGame();
    setPockets(game, { NGN: 500_000_00 });
    const { card, unmount } = await openBills(game);
    fireEvent.click(moveButton("place.makoko")!);
    const confirm = document.querySelector<HTMLButtonElement>("[data-ask-main]");
    expect(confirm?.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(confirm!);
      await Promise.resolve();
    });
    expect(game.state.home.place).toBe("place.makoko");
    const said = card()?.textContent ?? "";
    expect(said).toContain(phoneWords("phone.home.place.place.makoko"));
    // R-HOME-012: Makoko's figure is the room's rent by the month, charged whole, so the card says it; the living is by hand.
    expect(game.view().home.rent).toEqual({ currency: "NGN", amount: RENT });
    expect(said).toContain(`${formatMoney(RENT, "NGN")} a month`);
    expect(times(said, RISK)).toBe(1);
    expect(moveButton("place.family-house")?.disabled).toBe(true);
    expect(said).toContain(phoneWords("phone.home.shut.moved"));
    unmount();
  });

  test("[R-HOME-007] given Ada short of the first month's rent, when Bills opens, then the move to Makoko is shut and says what it needs", async () => {
    const game = newGame();
    setPockets(game, { NGN: RENT - 100 });
    const { card, unmount } = await openBills(game);
    expect(moveButton("place.makoko")?.disabled).toBe(true);
    expect(card()?.textContent).toContain(phoneWords("phone.home.shut.short", { amount: { currency: "NGN", amount: RENT } }));
    unmount();
  });

  test("[R-HOME-007] given Ada taken in after the settlement was cleared, when Bills opens, then the card says who took her in and for how long, and that no rent is charged", async () => {
    const game = start({ content: applyOverlay(content, { version: "test-card-evicted", tuning: { home: { evictionBp: 10000 } } }), scenario: "scenario.ada" });
    setPockets(game, { NGN: 500_000_00 });
    game.accept({ type: "home/move", to: "place.makoko" });
    game.endTurn();
    const offer = game.view().offers.find((open) => open.entry === "offer.taken-in")!;
    game.accept({ type: "offer/choose", offer: offer.id, choice: "someone" });
    const { card, unmount } = await openBills(game);
    const said = card()?.textContent ?? "";
    expect(said).toContain("Your sibling in Lagos");
    expect(said).toContain("3 more months");
    expect(said).toContain(phoneWords("phone.home.charge.none"));
    unmount();
  });

  test("[R-HOME-008] [R-HOME-009] given a life from sixteen in Makoko, when the move back is asked, then it names the family house's charge the home card gave, as the engine will charge it", async () => {
    const game = start({ content, scenario: "scenario.prologue", seed: "seed-1" });
    for (const answer of ["begin", "commercial", "work", "start-21", "save", "nowhere", "makoko"]) {
      const step = game.state.prologue.step;
      if (step === null) throw new Error(`The prologue closed before ${answer}.`);
      game.accept({ type: "prologue/choose", step, answer });
    }
    game.endTurn();
    const opens = content.prologue["home"]?.answers.find((answer) => answer.id === "family-house")?.effects.find((effect) => effect.type === "obligation/open");
    if (opens?.type !== "obligation/open" || typeof opens.amount !== "number") throw new Error("The home card's family house opens no upkeep.");
    // Decision 0035 (R-HOME-012): the family house's upkeep opens at the page's figure, but the engine charges none of it
    // as the month turns, so the move back names no figure a month and says the living is bought as you go.
    expect(opens.amount).toBeGreaterThan(0);
    expect(game.view().home.moves.find((move) => move.to === "place.family-house")?.monthly.amount).toBe(0);
    const { unmount } = await openBills(game);
    fireEvent.click(moveButton("place.family-house")!);
    expect(document.body.textContent).toContain(phoneWords("phone.home.move.line.place.family-house.by-hand"));
    expect(document.body.textContent).not.toContain(formatMoney(opens.amount, "NGN"));
    unmount();
  });

  test("[R-HOME-010] given Ada in the room in a compound, when Bills opens month by month, then the card says the year's rent and when it is next taken, with the living costs on their own line, counting down to this month", async () => {
    const game = newGame();
    setPockets(game, { NGN: 5_000_000_00 });
    game.accept({ type: "home/move", to: "place.compound-room" });
    const { home } = content.tuning;
    const year = formatMoney(home.compound.rentYear, "NGN");
    const first = await openBills(game);
    expect(document.querySelector("[data-home-rent-year]")?.textContent).toBe(`Rent ${year} a year, next in 11 months`);
    // Decision 0035: the room's living is bought as you go; its rent a year stays on its own line.
    expect(document.querySelector("[data-home-charge]")?.textContent).toBe(BY_HAND);
    expect(document.querySelector("[data-home-card]")?.textContent).not.toContain(formatMoney(home.compound.upkeep, "NGN"));
    first.unmount();
    while (game.state.turn.month < 10) {
      setPockets(game, { NGN: 5_000_000_00 });
      if (game.state.turn.banked < 1) game.grant(content.tuning.turn.cap);
      game.endTurn();
    }
    const next = await openBills(game);
    expect(document.querySelector("[data-home-rent-year]")?.textContent).toBe(`Rent ${year} a year, next due next month`);
    next.unmount();
    if (game.state.turn.banked < 1) game.grant(content.tuning.turn.cap);
    game.endTurn();
    const now = await openBills(game);
    expect(document.querySelector("[data-home-rent-year]")?.textContent).toBe(`Rent ${year} a year, due this month`);
    now.unmount();
  });

  test("[R-HOME-010] given Ada at the family house, when Bills opens, then no yearly rent shows and her charge reads as living costs", async () => {
    const game = newGame();
    const { unmount } = await openBills(game);
    expect(document.querySelector("[data-home-rent-year]")).toBeNull();
    // Decision 0035: the family house's living is bought as you go (food, water, fares), with no figure a month.
    expect(document.querySelector("[data-home-charge]")?.textContent).toBe("Living is bought as you go: food, water, fares.");
    unmount();
  });

  test("[R-HOME-010] given Ada in the room a month on, when the move back is asked, then it says the family house's charge is living costs with food and light, and that the year's rent stays with the landlord", async () => {
    const game = newGame();
    setPockets(game, { NGN: 5_000_000_00 });
    game.accept({ type: "home/move", to: "place.compound-room" });
    game.endTurn();
    const { unmount } = await openBills(game);
    fireEvent.click(moveButton("place.family-house")!);
    const said = document.body.textContent ?? "";
    expect(said).toContain("The year's rent stays with the landlord.");
    // Decision 0035: back home the living is bought as you go, so the move names no figure a month for it.
    expect(said).toContain("Back home. Living is bought as you go: food, water, fares.");
    expect(said).not.toContain(formatMoney(ADA_UPKEEP, "NGN"));
    unmount();
  });

  test("[R-HOME-007] given Ada abroad, when Bills opens, then no home card shows: the home is Lagos", async () => {
    const game = newGame();
    applyEffects(game, [{ type: "place/move", to: "abroad", country: "country.uk" }]);
    const { card, unmount } = await openBills(game);
    expect(card()).toBeNull();
    unmount();
  });
});

describe("the room in a compound on the card (R-HOME-010)", () => {
  const MOVE_IN = content.tuning.home.compound.rentYear + int.bp(content.tuning.home.compound.rentYear, content.tuning.home.compound.feesBp);
  const LIVING = content.tuning.home.compound.upkeep;

  test("[R-HOME-010] [R-HOME-008] given Ada with the year's rent and fees, when she rents the room from the card, then the button says what it takes now, the ask says the year and fees and the month's living, and once confirmed she lives there at the room's charge", async () => {
    const game = newGame();
    setPockets(game, { NGN: 1_000_000_00 });
    const { card, unmount } = await openBills(game);
    const button = moveButton("place.compound-room");
    expect(button?.disabled).toBe(false);
    expect(button?.textContent).toBe(`${phoneWords("phone.home.move.place.compound-room")}: ${formatMoney(MOVE_IN, "NGN")}`);
    fireEvent.click(button!);
    const asked = document.querySelector("[data-ask]")?.textContent ?? document.body.textContent ?? "";
    // Decision 0035: the ask says the year and fees taken now, and that the living is bought as you go, with no figure a month.
    expect(asked).toContain(phoneWords("phone.home.move.line.place.compound-room.by-hand", { now: { currency: "NGN", amount: MOVE_IN } }));
    expect(asked).toContain(formatMoney(MOVE_IN, "NGN"));
    expect(asked).not.toContain(formatMoney(LIVING, "NGN"));
    const confirm = document.querySelector<HTMLButtonElement>("[data-ask-main]");
    await act(async () => {
      fireEvent.click(confirm!);
      await Promise.resolve();
    });
    expect(game.state.home.place).toBe("place.compound-room");
    const said = card()?.textContent ?? "";
    expect(said).toContain(phoneWords("phone.home.place.place.compound-room"));
    // Decision 0035: the room's charge is its rent a year; its living is bought as you go.
    expect(said).toContain(formatMoney(content.tuning.home.compound.rentYear, "NGN"));
    expect(said).toContain(BY_HAND);
    expect(said).not.toContain(formatMoney(LIVING, "NGN"));
    expect(times(said, RISK)).toBe(1);
    expect(moveButton("place.family-house")?.disabled).toBe(true);
    unmount();
  });

  test("[R-HOME-010] [R-HOME-008] given Ada short of the year's rent and fees, when Bills opens, then the move to the room is shut and says it needs the year's rent and fees, not a month's", async () => {
    const game = newGame();
    setPockets(game, { NGN: MOVE_IN - 100 });
    const { unmount } = await openBills(game);
    expect(moveButton("place.compound-room")?.disabled).toBe(true);
    const shut = document.querySelector('[data-home-shut="place.compound-room"]')?.textContent;
    expect(shut).toBe(phoneWords("phone.home.shut.short.place.compound-room", { amount: { currency: "NGN", amount: MOVE_IN } }));
    expect(shut).toContain(formatMoney(MOVE_IN, "NGN"));
    unmount();
  });
});

describe("the home says what it is", () => {
  test("[R-HOME-008] given a life at the family house and one in the room in a compound, when Bills opens, then the home card opens with the place's own blurb", async () => {
    const family = await openBills(newGame("scenario.ada"));
    expect(family.card()?.querySelector("[data-home-blurb]")?.textContent).toBe(text["place.family-house.blurb"] ?? "");
    family.unmount();
    const game = newGame("scenario.ada");
    setPockets(game, { NGN: 5_000_000_00 });
    game.accept({ type: "home/move", to: "place.compound-room" });
    const room = await openBills(game);
    expect(room.card()?.querySelector("[data-home-blurb]")?.textContent).toMatch(/^One room in a compound of ten/);
    room.unmount();
  });
});
