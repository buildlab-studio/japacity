// The "changed into" lines under Kept (world:month-end-results-sheet). A change of money counts for nothing in Kept
// (decision 0024: the kept figure leaves out the change's two sides, the bank's charge stays money out), so a month
// whose band fell by the change could read as money hidden. So each change in the month is said under Kept on its own line, both sides
// as they were: "Changed ₦806,930 into £561". The side paid in at the bank is what went at the
// rate, the bank's charge told once on its own line, so Kept plus the changes is the band's move. Played on the real
// engine, the banker at home.
import { content } from "@japacity/content";
import { int, type Currency, type ReportLine } from "@japacity/sim";
import { act } from "@testing-library/react";
import { setPockets } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { CHANGED_INTO, changesInto, kept, moneyLines } from "./month.results";
import { Results } from "./Results";

type Game = ReturnType<typeof newGame>;

function held(game: Game, currency: Currency): number {
  const pocket = game.view().pockets[currency];
  return pocket.bank + pocket.cash;
}

/** One change, and both sides as the pockets moved: what went at the rate (the bank's charge apart) and what came in. */
function change(game: Game, from: Currency, to: Currency, amount: number, via: "bank" | "aboki"): { lines: ReportLine[]; paid: number; charge: number; got: number } {
  const before = { from: held(game, from), to: held(game, to) };
  const lines = game.accept({ type: "wallet/convert", from, to, amount, via }).lines;
  const charge = via === "bank" ? int.bp(amount, content.tuning.wallet.bankChargeBp) : 0;
  return { lines, paid: before.from - held(game, from) - charge, charge, got: held(game, to) - before.to };
}

function shownChanges(): string[] {
  return [...document.querySelectorAll<HTMLElement>("[data-results-change]")].map((line) => line.textContent ?? "");
}

describe("the changed-into lines under Kept", () => {
  test("[world:month-end-results-sheet] given naira changed into pounds at the bank, more with the FX man, and pounds changed back into naira, when the month's results show, then each change is one line under Kept with what went at the rate and what came in, in the order made, Kept counts only the bank's charges, and Kept plus the changes is the band's move", async () => {
    const game = newGame("scenario.banker");
    setPockets(game, { NGN: 200_000_000 });
    const start = held(game, "NGN");
    const atBank = change(game, "NGN", "GBP", 50_000_000, "bank");
    const moved = game.accept({ type: "wallet/move", currency: "NGN", amount: 30_000_000, to: "cash" }).lines;
    const withFxMan = change(game, "NGN", "GBP", 20_000_000, "aboki");
    const back = change(game, "GBP", "NGN", Math.floor(game.view().pockets.GBP.bank / 2 / 100) * 100, "bank");
    for (const each of [atBank, withFxMan, back]) expect([each.paid > 0, each.got > 0]).toEqual([true, true]);
    const now = [...atBank.lines, ...moved, ...withFxMan.lines, ...back.lines];
    game.endTurn();

    const money = moneyLines([...now, ...(game.view().report?.lines ?? [])]);
    expect(changesInto(money)).toEqual([
      { paid: { currency: "NGN", amount: atBank.paid }, got: { currency: "GBP", amount: atBank.got } },
      { paid: { currency: "NGN", amount: withFxMan.paid }, got: { currency: "GBP", amount: withFxMan.got } },
      { paid: { currency: "GBP", amount: back.paid }, got: { currency: "NGN", amount: back.got } },
    ]);

    const { store } = await renderWithView(<Results place="Home" />, game.view());
    act(() => store.setState({ reportOpen: true, lastMonthLines: now }));
    expect(shownChanges()).toEqual([
      `Changed ${formatMoney(atBank.paid, "NGN")} into ${formatMoney(atBank.got, "GBP")}`,
      `Changed ${formatMoney(withFxMan.paid, "NGN")} into ${formatMoney(withFxMan.got, "GBP")}`,
      `Changed ${formatMoney(back.paid, "GBP")} into ${formatMoney(back.got, "NGN")}`,
    ]);
    expect(shownChanges()[0]).toBe(say(CHANGED_INTO, { paid: { currency: "NGN", amount: atBank.paid }, got: { currency: "GBP", amount: atBank.got } }));
    // The lines sit under Kept, and the change is said once: no tag says it again (text:show-then-tell).
    const keptLine = document.querySelector("[data-results-kept]");
    const changes = document.querySelector("[data-results-changes]");
    expect(keptLine !== null && changes !== null && (keptLine.compareDocumentPosition(changes) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true);
    expect(document.querySelector("[data-results-tag='change']")).toBeNull();
    // A change counts for nothing either way: the naira kept is what the month really moved, the charges included.
    expect(keptLine?.getAttribute("data-results-kept")).toBe(String(kept(money).find((net) => net.currency === "NGN")?.amount ?? 0));
    // Kept plus the changes is the band's move, the bank's charges counted once.
    const nairaKept = kept(money).find((net) => net.currency === "NGN")?.amount ?? 0;
    const nairaChanged = changesInto(money).reduce((sum, each) => sum + (each.paid.currency === "NGN" ? -each.paid.amount : 0) + (each.got.currency === "NGN" ? each.got.amount : 0), 0);
    expect(nairaKept + nairaChanged).toBe(held(game, "NGN") - start);
  });

  test("[world:month-end-results-sheet] [text:show-then-tell] given the changed-into line, when its words are read, then they come from content, carry no raw key, and nothing in them looks like a bank alert", () => {
    const said = say(CHANGED_INTO, { paid: { currency: "NGN", amount: 80_693_000 }, got: { currency: "GBP", amount: 56_100 } });
    expect(said).toBe(`Changed ${formatMoney(80_693_000, "NGN")} into ${formatMoney(56_100, "GBP")}`);
    expect(said).not.toMatch(/ui\.|alert|credit|debit|ref|txn|✓/i);
  });

  test("[world:month-end-results-sheet] given a month with no change of money, when the results show, then no changed-into line shows", async () => {
    const game = newGame("scenario.banker");
    game.endTurn();
    const { store } = await renderWithView(<Results place="Home" />, game.view());
    act(() => store.setState({ reportOpen: true, lastMonthLines: [] }));
    expect(document.querySelector("[data-results-kept]")).not.toBeNull();
    expect(document.querySelector("[data-results-changes]")).toBeNull();
  });
});
