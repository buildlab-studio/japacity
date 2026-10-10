import type { PlayerView } from "@japacity/sim";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView, engineView, richAbroadView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { blurbOf, nameOf, say, sayCount, words } from "../../shared/words/text";
import { ClockBanner, renewal, StatusView } from "./StatusView";

describe("the status abroad", () => {
  test("[R-STATUS-010] given Ada on her student visa, then its name, the work it allows, the months left and the way up show", async () => {
    const view = abroadView();
    const held = view.status!;
    await renderWithView(<StatusView />, view);
    expect(screen.getByText(nameOf(held.entry))).toBeDefined();
    expect(screen.getByText(blurbOf(held.entry)!)).toBeDefined();
    expect(screen.getByText(say(`ui.status.work.${held.work}`))).toBeDefined();
    expect(screen.getByText(sayCount("ui.status.months-left", held.monthsLeft!, { months: held.monthsLeft! }))).toBeDefined();
    expect(screen.getByText(words(held.nextStep!))).toBeDefined();
    expect(screen.getByText(say("ui.status.no-settle"))).toBeDefined();
    // A student visa does not renew at the player's asking.
    expect(screen.queryByRole("button", { name: say("ui.status.renew") })).toBeNull();
  });

  test("[R-STATUS-010] given a sponsored worker, then the lawful months show against the months to settle", async () => {
    await renderWithView(<StatusView />, richAbroadView());
    expect(screen.getByRole("progressbar", { name: say("ui.status.lawful", { months: 16, need: 60 }) })).toBeDefined();
  });

  test("[R-STATUS-003] given the job gone and the clock running, then the clock is the loudest thing: a banner in big type", async () => {
    await renderWithView(<ClockBanner />, richAbroadView());
    const banner = screen.getByRole("alert");
    expect(banner.textContent).toContain(sayCount("ui.status.clock", 2, { months: 2 }));
    expect(banner.querySelector(".font-display")?.textContent).toBe("2");
  });

  test("[R-STATUS-003] given no clock running, then there is no banner", async () => {
    await renderWithView(<ClockBanner />, abroadView());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("[R-STATUS-006] given a sponsored worker with the job, then the renewal shows its fee and surcharge and renewing sends status/renew", async () => {
    const rich = richAbroadView();
    const view: PlayerView = { ...rich, job: { id: "activity.job-uk-skilled", months: 20, side: null, pay: null, sidePay: null }, status: { ...rich.status!, clock: null } };
    const cost = renewal(view.status!)!;
    expect(cost).toEqual(view.status!.renew);
    const { authority } = await renderWithView(<StatusView />, view);
    expect(
      screen.getByText(say("ui.status.renew-fees", { fee: formatMoney(cost.fee, "GBP"), surcharge: formatMoney(cost.surcharge, "GBP"), total: formatMoney(cost.fee + cost.surcharge, "GBP") })),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.status.renew") }));
    fireEvent.click(screen.getByRole("button", { name: say("ui.status.renew-yes", { total: formatMoney(cost.fee + cost.surcharge, "GBP") }) }));
    await waitFor(() => expect(authority.sent).toEqual([{ type: "status/renew", basedOn: view.v }]));
  });

  test("[R-STATUS-006] given a sponsored worker whose job has gone, then renewing waits for the job", async () => {
    await renderWithView(<StatusView />, richAbroadView());
    expect(screen.getByText(say("ui.status.renew-needs-job"))).toBeDefined();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: say("ui.status.renew") }).disabled).toBe(true);
  });

  test("given a life at home, then no status panel shows", async () => {
    await renderWithView(<StatusView />, engineView());
    expect(screen.queryByText(say("ui.status.title"))).toBeNull();
  });
});
