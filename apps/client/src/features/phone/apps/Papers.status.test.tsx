// The status held abroad in Papers (status:view-shows-status, status:renewing-a-status):
// its name, the work it allows, the months left, the lawful months toward settling, the way up and the renewal.
import type { PlayerView } from "@japacity/sim";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView, engineView, richAbroadView } from "../../../shared/testing/fixtures";
import { graceView, noticeGame, overstayingGame } from "../../../shared/testing/overstay";
import { overstayWords } from "../../../shared/words/overstay";
import { formatMoney } from "../../../shared/words/format";
import { blurbOf, nameOf, say, sayCount, words } from "../../../shared/words/text";
import { openPapers } from "../phone.testing";

function statusCard(): HTMLElement {
  const card = document.querySelector<HTMLElement>("[data-papers-status]");
  if (card === null) throw new Error("No status in Papers.");
  return card;
}

describe("the status abroad, in Papers", () => {
  test("[status:view-shows-status] given the graduate on its student visa, then its name, the work it allows, the months left and the way up show", async () => {
    const view = abroadView();
    const held = view.status!;
    await openPapers(view, "London");
    const card = within(statusCard());
    expect(card.getByText(nameOf(held.entry))).toBeDefined();
    expect(card.getByText(blurbOf(held.entry)!)).toBeDefined();
    expect(card.getByText(say(`ui.status.work.${held.work}`))).toBeDefined();
    expect(card.getByText(sayCount("ui.status.months-left", held.monthsLeft!, { months: held.monthsLeft! }))).toBeDefined();
    expect(card.getByText(words(held.nextStep!))).toBeDefined();
    expect(card.getByText(say("ui.status.no-settle"))).toBeDefined();
    // A student visa does not renew at the player's asking.
    expect(card.queryByRole("button", { name: say("ui.status.renew") })).toBeNull();
  });

  test("[status:view-shows-status] given a sponsored worker, then the lawful months show against the months to settle", async () => {
    await openPapers(richAbroadView(), "London");
    expect(within(statusCard()).getByRole("progressbar", { name: say("ui.status.lawful", { months: 16, need: 60 }) })).toBeDefined();
  });

  test("[status:renewing-a-status] given a sponsored worker with the job, then the renewal shows its fee and surcharge and renewing sends status/renew", async () => {
    const rich = richAbroadView();
    const view: PlayerView = { ...rich, job: { id: "activity.job-uk-skilled", months: 20, side: null, pay: null, sidePay: null }, status: { ...rich.status!, clock: null } };
    const cost = view.status!.renew!;
    const { authority } = await openPapers(view, "London");
    const card = within(statusCard());
    expect(card.getByText(say("ui.status.renew-fees", { fee: formatMoney(cost.fee, "GBP"), surcharge: formatMoney(cost.surcharge, "GBP"), total: formatMoney(cost.fee + cost.surcharge, "GBP") }))).toBeDefined();
    fireEvent.click(card.getByRole("button", { name: say("ui.status.renew") }));
    fireEvent.click(card.getByRole("button", { name: say("ui.status.renew-yes", { total: formatMoney(cost.fee + cost.surcharge, "GBP") }) }));
    await waitFor(() => expect(authority.sent).toEqual([{ type: "status/renew", basedOn: view.v }]));
  });

  test("[status:renewing-a-status] given a sponsored worker whose job has gone, then renewing waits for the job", async () => {
    await openPapers(richAbroadView(), "London");
    const card = within(statusCard());
    expect(card.getByText(say("ui.status.renew-needs-job"))).toBeDefined();
    expect(card.getByRole<HTMLButtonElement>("button", { name: say("ui.status.renew") }).disabled).toBe(true);
  });

  test("[status:view-shows-status] given a life at home, then Papers shows no status", async () => {
    await openPapers(engineView(), "London");
    expect(document.querySelector("[data-papers]")).not.toBeNull();
    expect(document.querySelector("[data-papers-status]")).toBeNull();
    expect(screen.queryByText(say("ui.status.title"))).toBeNull();
  });
});

describe("the overstay, in Papers", () => {
  /** The stage block on the status card, or a throw. */
  function stage(): HTMLElement {
    const block = statusCard().querySelector<HTMLElement>("[data-overstay]");
    if (block === null) throw new Error("No overstay stage on the status card.");
    return block;
  }

  test("[status:grace-before-overstaying] [status:view-shows-status] given the visa just lapsed, when Papers opens, then the status card says the months of grace left and what can still be applied for from inside, in place of an end date or a way up", async () => {
    const view = graceView();
    const said = overstayWords(view)!;
    await openPapers(view, "London");
    expect(stage().dataset.overstay).toBe("grace");
    expect(stage().textContent).toContain(said.title);
    expect(stage().textContent).toContain(said.line);
    const card = within(statusCard());
    expect(card.queryByText(say("ui.status.no-end"))).toBeNull();
    expect(card.queryByText(words(view.status!.nextStep!))).toBeNull();
    // The visa's own row says the stage too, never "No end date".
    expect(document.querySelector(`[data-paper="${view.status!.entry}"] [data-paper-state]`)?.textContent).toBe(said.title);
  });

  test("[status:view-shows-status] given the grace passed, when Papers opens, then the card says overstaying, cash work only and the landlord's check", async () => {
    const view = overstayingGame().view();
    await openPapers(view, "London");
    expect(stage().dataset.overstay).toBe("over");
    expect(stage().textContent).toContain(say("ui.status.overstay.over"));
    expect(stage().textContent).toContain(say("ui.status.overstay.over-line.country.uk"));
  });

  test("[status:detection-gives-notice] [status:view-shows-status] given a notice, when Papers opens, then the card says the months left before removal", async () => {
    const view = noticeGame().view();
    await openPapers(view, "London");
    expect(stage().dataset.overstay).toBe("notice");
    expect(stage().textContent).toContain(overstayWords(view)!.title);
    expect(stage().textContent).toContain(say("ui.status.overstay.notice-line"));
    expect(stage().textContent).not.toMatch(/%/);
  });
});
