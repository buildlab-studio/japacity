// The trades' papers and the gift's deed in Papers (document:trade-papers, route-gates:family-gift-counts-with-deed): the teaching
// registration for a teacher whose next rung asks it, the chartered exams for a banker or accountant whose next rung asks them, each with its
// fee, its wait or its sittings and the act that moves it on the phone; and the notary's deed once the family's gift is taken.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame } from "../../../shared/testing/fixtures";
import { formatMoney } from "../../../shared/words/format";
import { nameOf, say, sayCount } from "../../../shared/words/text";
import { PHONE_ACTS, papersOf } from "../papers";
import { openPapers } from "../phone.testing";

const card = (id: string) => document.querySelector<HTMLElement>(`[data-paper="${id}"]`);

describe("the trades' papers", () => {
  test("[document:trade-papers] [activity:each-trade-climbs-its-ladder] given the teacher, whose senior rung asks the registration, when Papers opens, then the registration is listed with its fee, its wait, the rung it opens, and its act on the phone", async () => {
    const view = newGame("scenario.teacher").view();
    const row = papersOf(view).find((each) => each.id === "document.trcn");
    expect(row).toMatchObject({ state: "not-yet", act: { activity: "activity.get-trcn", how: "phone" } });
    expect(PHONE_ACTS.has("activity.get-trcn")).toBe(true);
    await openPapers(view);
    const shown = card("document.trcn");
    expect(shown?.querySelector("[data-paper-costs]")?.textContent).toBe(sayCount("phone.papers.costs", 2, { fee: formatMoney(25_000_00, "NGN"), months: 2 }));
    expect(shown?.querySelector("[data-paper-opens]")?.textContent).toBe(say("phone.papers.opens", { job: nameOf("activity.job-senior-teacher") }));
    expect(shown?.querySelector("[data-paper-act]")?.getAttribute("data-act-how")).toBe("phone");
  });

  test("[document:trade-papers] given the banker, whose next rung asks the chartered exams, when Papers opens, then they are listed with the fee a sitting and the sittings, and the study is taken on the phone", async () => {
    const view = newGame("scenario.banker").view();
    const row = papersOf(view).find((each) => each.id === "document.ican");
    expect(row).toMatchObject({ state: "not-yet", act: { activity: "activity.ican-exams", how: "phone" } });
    await openPapers(view);
    const exam = content.activity["activity.ican-exams"]!;
    const every = exam.onMonth?.[0]?.at ?? 0;
    expect(card("document.ican")?.querySelector("[data-paper-costs]")?.textContent).toBe(
      say("phone.papers.sittings", { fee: formatMoney(50_000_00, "NGN"), count: exam.exam!.sittings!, months: every }),
    );
  });

  test("[document:trade-papers] given the graduate, whose next step asks no trade paper, when Papers is read, then neither trade paper is listed", () => {
    const rows = papersOf(newGame("scenario.graduate").view());
    expect(rows.some((row) => row.id === "document.trcn" || row.id === "document.ican")).toBe(false);
  });
});

describe("the gift's deed", () => {
  test("[route-gates:family-gift-counts-with-deed] given the family's gift taken and no deed yet, when Papers opens, then the deed is listed with its fee and wait, says Canada counts the gift once it is held, and is asked for on the phone", async () => {
    const base = newGame("scenario.teacher").view();
    const view: PlayerView = { ...base, activities: base.activities.map((option) => (option.id === "activity.gift-deed" ? { ...option, allowed: true, missing: [] } : option)) };
    expect(PHONE_ACTS.has("activity.gift-deed")).toBe(true);
    await openPapers(view);
    const shown = card("document.gift-deed");
    expect(shown?.querySelector("[data-paper-costs]")?.textContent).toBe(sayCount("phone.papers.costs", 1, { fee: formatMoney(20_000_00, "NGN"), months: 1 }));
    expect(shown?.querySelector("[data-paper-opens]")?.textContent).toBe(say("phone.papers.opens.document.gift-deed"));
    expect(shown?.querySelector("[data-paper-act]")?.getAttribute("data-act-how")).toBe("phone");
  });

  test("[route-gates:family-gift-counts-with-deed] given no gift taken, when Papers is read, then no deed is listed", () => {
    expect(papersOf(newGame("scenario.teacher").view()).some((row) => row.id === "document.gift-deed")).toBe(false);
  });
});
