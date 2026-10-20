// The Bank as the passbook (wallet:passbook-against-plan-cost, wallet:savings-stamps, wallet:saving-pace and wallet:roads-to-the-target): its first page is the
// money held for the road against the plan's whole cost, the stamps as stickers, last month in and out as chips, the roads
// as cards with one tap each and the pace line under the figure, every figure the view's own (PlayerView.passbook).
// These tests cite the Bank's rule, world:phone-holds-what-phones-hold, and the moments' rules for the stamp's card. Played on the real
// engine and content.
import { content, uiPassbookText } from "@japacity/content";
import type { Effect, PlayerView } from "@japacity/sim";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { GameProvider } from "../../../authority/GameProvider";
import { createGameStore } from "../../../authority/store";
import { momentFace, momentLine } from "../../../shared/moment/moment";
import { PhoneNav } from "../../../shared/phone/nav";
import { gameAuthority, newGame, viewAfter } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { formatMoney } from "../../../shared/words/format";
import { moneyLines } from "../../../shared/words/money";
import { nameOf, runningName, say } from "../../../shared/words/text";
import { Bank } from "./Bank";
import { passbookCount, shortNaira } from "./passbook.words";

const CARE = "route.uk-care" as const;

/** The nurse with health care as its plan, looked into, a month lived so the pace shows. */
function nurse(months = 1) {
  const game = newGame("scenario.nurse");
  const bars = (content.route[CARE]?.hearIf ?? []).flatMap((requirement): Effect[] => (requirement.type === "quality/min" ? [{ type: "quality/add", quality: requirement.quality, amount: requirement.value }] : []));
  viewAfter(game, [...bars, { type: "route/hear", route: CARE, via: "meetup" }]);
  game.accept({ type: "activity/now", activity: "activity.look-into-route", param: CARE });
  for (let month = 0; month < months; month += 1) game.endTurn();
  return game;
}

function passbookOf(view: PlayerView) {
  if (view.passbook === null) throw new Error("No passbook in the view.");
  return view.passbook;
}

function text(selector: string): string {
  return document.querySelector(selector)?.textContent ?? "";
}

describe("the Bank's first page, the passbook", () => {
  test("[wallet:saving-pace] [world:phone-holds-what-phones-hold] given the nurse a month into its care plan, when the Bank opens, then it leads with what is held against the road's whole cost, the bar and the pace line the view gives, the best road beside it", async () => {
    const view = nurse().view();
    const book = passbookOf(view);
    expect(book.months).toBeGreaterThan(1);
    await renderWithView(<Bank />, view);
    const card = document.querySelector("[data-passbook]")!;
    expect(card.querySelector("[data-passbook-held]")?.textContent).toBe(formatMoney(book.held, "NGN"));
    expect(card.querySelector("[data-passbook-target]")?.textContent).toBe(say("passbook.of", { target: shortNaira(book.target!.total) }));
    expect(card.querySelector('[role="progressbar"]')?.getAttribute("aria-valuemax")).toBe(String(book.target!.total));
    const pace = text("[data-pace]");
    expect(pace).toContain(say("passbook.pace", { months: book.months! }));
    const best = book.roads.find((road) => road.road === book.best)!;
    expect(document.querySelector("[data-pace-best]")?.getAttribute("data-pace-best")).toBe(String(best.months));
    expect(pace).toContain(`${String(best.months)}.`);
    // The first page comes before the rest of the bank.
    const order = ["[data-passbook]", "[data-stamps]", "[data-roads]", "[data-bank-saved]", "[data-bank-lately]"].map((selector) => document.querySelector(selector));
    expect(order.slice(1).every((element, index) => (order[index]!.compareDocumentPosition(element!) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0)).toBe(true);
  });

  test("[wallet:saving-pace] [world:phone-holds-what-phones-hold] given no plan, or a plan only heard of, when the Bank opens, then the pace line says what sets the road's cost and no target is drawn", async () => {
    await renderWithView(<Bank />, newGame("scenario.nurse").view());
    expect(text("[data-pace]")).toBe(say("passbook.pace.no-plan"));
    expect(document.querySelector("[data-passbook-target]")).toBeNull();
    const game = newGame("scenario.nurse");
    const heard = viewAfter(game, [{ type: "route/hear", route: CARE, via: "meetup" }]);
    await renderWithView(<Bank />, heard);
    expect(document.querySelectorAll("[data-pace]")[1]?.textContent).toBe(say("passbook.pace.unread", { route: runningName(CARE) }));
  });

  test("[wallet:savings-stamps] [world:phone-holds-what-phones-hold] given the stamps the view carries, when the Bank opens, then each is a round sticker with its short sum, the reached ones filled with their month and the road's own last", async () => {
    const game = nurse();
    viewAfter(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 50_000_000, reason: "gift" }]);
    game.endTurn();
    const view = game.view();
    const book = passbookOf(view);
    await renderWithView(<Bank />, view);
    const stamps = [...document.querySelectorAll<HTMLElement>("[data-stamp]")];
    expect(stamps.map((stamp) => Number(stamp.dataset.stamp))).toEqual(book.stamps.map((stamp) => stamp.at));
    expect(stamps.map((stamp) => stamp.dataset.stampReached ?? null)).toEqual(book.stamps.map((stamp) => (stamp.month === null ? null : String(stamp.month))));
    expect(stamps.at(-1)?.dataset.stampTarget).toBe("");
    expect(stamps[0]?.textContent).toContain(shortNaira(content.tuning.wallet.stamps[0]!));
    expect(stamps[0]?.textContent).toContain(say("passbook.stamp.heard"));
  });

  test("[wallet:passbook-against-plan-cost] [world:phone-holds-what-phones-hold] given last month's money, when the Bank opens, then it shows as chips, in before out, each the month's total in its money", async () => {
    const view = nurse().view();
    await renderWithView(<Bank />, view);
    const money = moneyLines(view.report!.lines);
    const sum = (sign: 1 | -1) => money.filter((each) => each.sign === sign && each.currency === "NGN").reduce((total, each) => total + each.amount, 0);
    const chips = [...document.querySelectorAll<HTMLElement>("[data-last-month-chip]")];
    // The nurse's month paid its salary in and its share for home out.
    expect(sum(1)).toBeGreaterThan(0);
    expect(sum(-1)).toBeGreaterThan(0);
    expect(chips.map((chip) => chip.dataset.lastMonthChip)).toEqual(["in", "out"]);
    expect(chips.map((chip) => chip.textContent)).toEqual([say("passbook.in", { amount: formatMoney(sum(1), "NGN") }), say("passbook.out", { amount: formatMoney(sum(-1), "NGN") })]);
  });

  test("[wallet:roads-to-the-target] [world:phone-holds-what-phones-hold] given the nurse's roads, when the Bank opens, then each is a card with its state and the view's months, and a job's road opens the Jobs app", async () => {
    const view = nurse().view();
    const book = passbookOf(view);
    const openApp = vi.fn();
    const authority = gameAuthority(nurse());
    const store = createGameStore(authority);
    await store.getState().refresh();
    render(
      <GameProvider store={store}>
        <PhoneNav value={{ openApp, close: () => undefined }}>
          <Bank />
        </PhoneNav>
      </GameProvider>,
    );
    const cards = [...document.querySelectorAll<HTMLElement>("[data-road]")];
    expect(cards.map((card) => card.dataset.road)).toEqual(book.roads.map((road) => road.road));
    expect(cards.map((card) => card.dataset.roadState)).toEqual(book.roads.map((road) => road.state));
    const counted = book.roads.filter((road) => road.state !== "taken" && road.months !== null);
    expect(counted.length).toBeGreaterThan(0);
    expect(counted.map((road) => document.querySelector<HTMLElement>(`[data-road="${road.road}"] [data-road-months]`)?.textContent)).toEqual(counted.map((road) => passbookCount("passbook.road.months", road.months!)));
    const side = book.roads.find((road) => road.road === "side")!;
    expect(document.querySelector('[data-road="side"]')?.textContent).toContain(nameOf(side.via));
    fireEvent.click(document.querySelector<HTMLElement>('[data-road="side"]')!);
    expect(openApp).toHaveBeenCalledWith("jobs");
  });

  test("[wallet:roads-to-the-target] [world:phone-holds-what-phones-hold] given Papa's loan as a road, when it is tapped, then the call's card asks Papa; once he offers, its card takes the loan and the money is held", async () => {
    const game = nurse();
    const store = createGameStore(gameAuthority(game));
    await store.getState().refresh();
    render(
      <GameProvider store={store}>
        <Bank />
      </GameProvider>,
    );
    fireEvent.click(document.querySelector<HTMLElement>('[data-road="family"]')!);
    act(() => {
      fireEvent.click(document.querySelector<HTMLElement>("[data-ask-main]")!);
    });
    await waitFor(() => expect(store.getState().view?.offers.some((offer) => offer.entry === "offer.family-loan")).toBe(true));
    const lend = passbookOf(store.getState().view!).roads.find((road) => road.road === "family")!.lump;
    const held = passbookOf(store.getState().view!).held;
    await waitFor(() => expect(document.querySelector('[data-road="family"]')?.getAttribute("data-road-state")).toBe("open"));
    fireEvent.click(document.querySelector<HTMLElement>('[data-road="family"]')!);
    act(() => {
      fireEvent.click(document.querySelector<HTMLElement>("[data-ask-main]")!);
    });
    await waitFor(() => expect(passbookOf(store.getState().view!).held).toBe(held + lend));
    await waitFor(() => expect(document.querySelector('[data-road="family"]')?.getAttribute("data-road-state")).toBe("shut"));
  });

  test("[wallet:roads-to-the-target] [world:phone-holds-what-phones-hold] given a road that waits, when it is tapped, then it shakes and nothing is sent", async () => {
    const game = nurse();
    const authority = gameAuthority(game);
    const store = createGameStore(authority);
    await store.getState().refresh();
    render(
      <GameProvider store={store}>
        <Bank />
      </GameProvider>,
    );
    const ajo = document.querySelector<HTMLElement>('[data-road="ajo"]')!;
    expect(ajo.dataset.roadState).toBe("shut");
    const sent = authority.sent.length;
    fireEvent.click(ajo);
    expect(ajo.className).toContain("shake");
    expect(document.querySelector("[data-ask-main]")).toBeNull();
    expect(authority.sent.length).toBe(sent);
  });

  test("[wallet:passbook-against-plan-cost] [world:phone-holds-what-phones-hold] given the passbook's words on the screen, when they are read, then none says slots, a turn, banked, pages, days left or a percentage", async () => {
    await renderWithView(<Bank />, nurse(2).view());
    const said = [...document.querySelectorAll("[data-passbook], [data-stamps], [data-last-month], [data-roads]")].map((part) => part.textContent ?? "").join(" ");
    expect(said).not.toMatch(/\bslots?\b|\bturns?\b|\bbanked\b|\bpages?\b|days left|%/i);
    expect(Object.values(uiPassbookText).join(" ")).not.toMatch(/\bslots?\b|\bturns?\b|\bbanked\b|\bpages?\b|days left|%|[–—!]/i);
  });
});

describe("a stamp as a moment", () => {
  test("[wallet:savings-stamps] [moment:new-moments-join-same-way] [moment:outcomes-that-are-moments] given a month whose close reached stamps, when its lines are read, then the highest is the one card, the sum held as its figure", () => {
    const game = nurse();
    viewAfter(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 250_000_000, reason: "gift" }]);
    const lines = game.endTurn().lines;
    const view = game.view();
    const line = momentLine(lines, view);
    expect(line?.key).toBe("line.passbook.ready");
    const face = momentFace(line!, view)!;
    expect(face).toMatchObject({ kind: "held", tone: "good", icon: "piggy-bank", title: nameOf(CARE) });
    expect(face.figure).toEqual({ value: passbookOf(view).stamps.at(-1)!.at, unit: { kind: "money", currency: "NGN" }, caption: expect.any(String) as string });
  });

  test("[wallet:savings-stamps] [moment:card-never-looks-official] [moment:words-in-game-voice] given a fixed stamp's card, when its words are read, then it names Mama hearing and nothing that reads as a bank alert", () => {
    const game = nurse();
    viewAfter(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 40_000_000, reason: "gift" }]);
    const lines = game.endTurn().lines;
    const face = momentFace(momentLine(lines, game.view())!, game.view())!;
    expect(face.kind).toBe("held");
    expect(face.figure.value).toBe(content.tuning.wallet.stamps[0]);
    const said = [face.kicker, face.title, face.line, face.figure.caption].join(" ");
    expect(said).not.toMatch(/alert|credit|debit|transaction|receipt|account|balance|transfer|\bbank|stamp|[!–—]/i);
  });
});
