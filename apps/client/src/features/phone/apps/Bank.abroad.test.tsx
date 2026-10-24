// The Bank abroad (world:top-band-is-a-pill, world:phone-holds-what-phones-hold): on the graduate's recorded life, landed in London with £4,716
// (the figure follows the recording) while rent, living costs and half the tuition, £5,685 in all, fall due (the UK
// upkeep includes the phone's £15, abroad-money:arrival-opens-upkeep-and-room), the app leads with the gap and the way to close it, then the pounds,
// then the naira and the dollars each with Change money. Once flown, there is no move to save toward.
import type { PlayerView } from "@japacity/sim";
import { fireEvent, waitFor, within } from "@testing-library/react";
import { setPockets } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { recordedGame, viewAfter } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { bandMoney } from "../../../shared/world/TopBand";
import { duesGap, heldElsewhere } from "../../../shared/words/dues";
import { formatMoney } from "../../../shared/words/format";
import { say } from "../../../shared/words/text";
import { Bank } from "./Bank";
import { PhoneApps } from "../PhoneApps";
import { sent } from "../phone.testing";

/** The graduate's careful life, replayed to the flight: the first morning abroad. */
function landed(): PlayerView {
  return recordedGame("graduate-careful").view();
}

function dueOf(view: PlayerView): number {
  return view.obligations.filter((owed) => owed.due > 0).reduce((sum, owed) => sum + owed.due, 0);
}

describe("the month's dues abroad", () => {
  // The recorded life lands the graduate holding £4,716 (decisions 0012 and 0013).
  test("[world:phone-holds-what-phones-hold] given the graduate landed in London holding £4,716 with rent, living costs and tuition due, when the dues are read, then the gap is the pounds due against the pounds held, and the naira and dollars are the way", () => {
    const view = landed();
    expect(view.place.where).toBe("abroad");
    const gap = duesGap(view);
    expect(gap).toEqual({ currency: "GBP", due: dueOf(view), held: view.pockets.GBP.bank + view.pockets.GBP.cash, from: ["NGN", "USD"] });
    expect(formatMoney(gap?.due ?? 0, "GBP")).toBe("£5,685");
    expect(formatMoney(gap?.held ?? 0, "GBP")).toBe("£4,716");
  });

  test("[world:phone-holds-what-phones-hold] given the pounds held equal to the month's dues, when the dues are read, then there is no gap; a penny less and the gap shows", () => {
    const game = recordedGame("graduate-careful");
    const due = dueOf(game.view());
    setPockets(game, { GBP: due });
    expect(duesGap(game.view())).toBeNull();
    setPockets(game, { GBP: due - 1 });
    expect(duesGap(game.view())).toMatchObject({ currency: "GBP", due, held: due - 1 });
  });

  test("[world:phone-holds-what-phones-hold] given the graduate holding dollars enough for the month and changing them all into pounds at the bank, when the dues are read, then the gap is closed", () => {
    const game = recordedGame("graduate-careful");
    // Half the tuition falls in the first month (abroad-money:tuition-paid-in-instalments), more than the recorded life's dollars cover.
    setPockets(game, { USD: 2_000_000 });
    game.accept({ type: "wallet/convert", from: "USD", to: "GBP", amount: game.view().pockets.USD.bank, via: "bank" });
    expect(duesGap(game.view())).toBeNull();
  });

  test("[world:phone-holds-what-phones-hold] given a life at home, when the dues are read, then there is no gap to show: the naira's dues are the Bills app's", () => {
    const game = recordedGame("graduate-careful", 1);
    expect(game.view().place.where).toBe("home");
    expect(duesGap(game.view())).toBeNull();
  });

  test("[world:top-band-is-a-pill] given the gap on landing, when the band counts, then it stays the country's money", () => {
    const view = landed();
    expect(duesGap(view)).not.toBeNull();
    const band = bandMoney(view);
    expect(band.money).toBe(view.pockets.GBP.bank + view.pockets.GBP.cash);
    // The recorded life lands with £4,716 (decision 0012).
    expect(band.formatMoney(band.money)).toBe("£4,716");
  });

  test("[world:phone-holds-what-phones-hold] given money held in naira and dollars, when the other money is listed, then the naira comes first and a currency with nothing in it is left out", () => {
    const view = landed();
    expect(heldElsewhere(view, "GBP")).toEqual(["NGN", "USD"]);
    expect(heldElsewhere({ ...view, pockets: { ...view.pockets, USD: { bank: 0, cash: 0, locked: 0 } } }, "GBP")).toEqual(["NGN"]);
  });
});

describe("the Bank abroad", () => {
  test("[world:phone-holds-what-phones-hold] given the graduate on landing with the gap, when the Bank opens, then it leads with what is due and what is held, and the way: naira or dollars to pounds", async () => {
    await renderWithView(<Bank />, landed());
    const app = document.querySelector<HTMLElement>('[data-phone-app="bank"]');
    const first = app?.firstElementChild as HTMLElement | null;
    expect(first?.hasAttribute("data-dues-gap")).toBe(true);
    // The recorded life lands with £4,716 (decision 0012).
    expect(first?.textContent).toContain(say("phone.bank.dues", { due: "£5,685", held: "£4,716" }));
    expect(say("phone.bank.dues", { due: "£5,685", held: "£4,716" })).toBe("Due this month: £5,685. You hold £4,716.");
    // The way names the pair only: Change money is said once on the screen.
    expect(within(first ?? document.body).getByRole("button").textContent).toBe("Naira or dollars to pounds");
  });

  test("[world:phone-holds-what-phones-hold] given the graduate abroad, when the Bank opens, then the pounds stand first as the balance, and the naira and the dollars follow under Change money, each with its pair", async () => {
    // Decision 0013: the recorded life flies with no naira cash on it, so a little is put in its pocket by the
    // wallet's own effect, and the row is still read as bank and cash together.
    const view = viewAfter(recordedGame("graduate-careful"), [{ type: "money/add", currency: "NGN", pocket: "cash", amount: 500_000, reason: "gift" }]);
    await renderWithView(<Bank />, view);
    const balance = document.querySelector<HTMLElement>("[data-bank-balance]");
    expect(balance?.getAttribute("data-bank-balance")).toBe("GBP");
    expect(balance?.querySelector("[data-counter]")?.getAttribute("data-counter")).toBe(String(view.pockets.GBP.bank));
    const rows = [...document.querySelectorAll<HTMLElement>("[data-held]")];
    expect(rows.map((row) => row.getAttribute("data-held"))).toEqual(["NGN", "USD"]);
    // Each row is the money held there, bank and cash.
    expect(view.pockets.NGN.cash).toBeGreaterThan(0);
    expect(rows[0]?.textContent).toContain(formatMoney(view.pockets.NGN.bank + view.pockets.NGN.cash, "NGN"));
    expect(rows[1]?.textContent).toContain(formatMoney(view.pockets.USD.bank + view.pockets.USD.cash, "USD"));
    expect(rows.map((row) => within(row).getByRole("button").textContent)).toEqual(["Naira to pounds", "Dollars to pounds"]);
  });

  test("[world:phone-holds-what-phones-hold] given the graduate abroad with the gap and two other monies, when the Bank opens, then Change money is said once on the screen, with the pairs under it", async () => {
    await renderWithView(<Bank />, landed());
    const app = document.querySelector<HTMLElement>('[data-phone-app="bank"]');
    expect((app?.textContent ?? "").split(say("ui.wallet.convert")).length - 1).toBe(1);
    expect(app?.querySelector("[data-change-pairs]")?.textContent).toContain(say("ui.wallet.convert"));
  });

  test("[world:phone-holds-what-phones-hold] [wallet:bank-converts-at-official-rate] given the dollars' row, when its Change money is chosen and the card confirmed, then a quarter of the dollars goes into pounds at the bank", async () => {
    const view = landed();
    const { authority } = await renderWithView(<Bank />, view);
    const row = document.querySelector<HTMLElement>('[data-held="USD"]');
    fireEvent.click(within(row ?? document.body).getByRole("button"));
    fireEvent.click(document.querySelector<HTMLElement>('[data-go="change"]')!);
    fireEvent.click(document.querySelector<HTMLElement>("[data-ask-main]")!);
    const quarter = Math.floor(view.pockets.USD.bank / 4 / 100) * 100;
    await waitFor(() => expect(sent(authority)).toEqual([{ type: "wallet/convert", from: "USD", to: "GBP", amount: quarter, via: "bank" }]));
  });

  test("[world:phone-holds-what-phones-hold] given the gap's way, when it is chosen, then the change opens from the dollars into pounds, the money that changes at once", async () => {
    await renderWithView(<Bank />, landed());
    fireEvent.click(within(document.querySelector<HTMLElement>("[data-dues-gap]") ?? document.body).getByRole("button"));
    const chooser = document.querySelector<HTMLElement>('[data-chooser="change"]');
    expect(chooser).not.toBeNull();
    const checked = [...(chooser?.querySelectorAll<HTMLElement>('[role="radio"][aria-checked="true"]') ?? [])].map((radio) => radio.textContent);
    expect(checked).toContain("Dollars");
    expect(checked).toContain("Pounds");
  });

  test("[world:phone-holds-what-phones-hold] given the graduate flown, when the Bank opens, then the move's target is gone: no saved for the move", async () => {
    const view = landed();
    expect(view.japacity.percent).toBe(100);
    await renderWithView(<Bank />, view);
    expect(document.querySelector("[data-savings]")).toBeNull();
    expect(document.body.textContent).not.toContain(say("phone.bank.savings"));
  });

  test("[world:phone-holds-what-phones-hold] given the pounds held cover the month, when the Bank opens abroad, then no gap is shown", async () => {
    const game = recordedGame("graduate-careful");
    setPockets(game, { GBP: dueOf(game.view()) });
    await renderWithView(<Bank />, game.view());
    expect(document.querySelector("[data-dues-gap]")).toBeNull();
  });

  // The room's phone says Send money home, so it opens the chooser itself.
  test("[world:phone-holds-what-phones-hold] given the phone opened on sending money home, when the handset shows, then the Bank opens with the send chooser out, not its front page", async () => {
    await renderWithView(<PhoneApps onClose={() => undefined} area="The room" now={() => new Date(2026, 9, 9, 12, 5)} talk={null} start="bank:send" />, landed());
    expect(document.querySelector('[data-phone-app="bank"]')).not.toBeNull();
    expect(document.querySelector('[data-chooser="send"]')).not.toBeNull();
    expect(document.querySelector('[data-bank-act="send"]')?.getAttribute("aria-expanded")).toBe("true");
  });
});
