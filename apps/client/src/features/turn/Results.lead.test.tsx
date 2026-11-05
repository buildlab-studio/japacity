// The month's results lead with the money and the people (world:month-end-results-sheet): what the month kept or lost
// and the savings bar first, then each ask still open as a face whose tap opens its card, then the month's events that
// changed what the player holds or answered what the player started; the rest of the month lives in News only.
import type { PlayerView, ReportLine } from "@japacity/sim";
import { act, fireEvent } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { newGame, openOffer, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say, words } from "../../shared/words/text";
import { storyLines } from "./month.results";
import { Results } from "./Results";

const naira = (amount: number) => ({ currency: "NGN" as const, amount });
function line(key: string, params: ReportLine["params"], tone: ReportLine["tone"] = "plain", attention = false): ReportLine {
  return { key, params, tone, attention, counts: [] };
}

/** The sheet's parts in the order they stand. */
function parts(): string[] {
  const named: [string, string][] = [
    ["data-results-payday", "payday"],
    ["data-results-rent", "rent"],
    ["data-results-kept", "kept"],
    ["data-results-savings", "savings"],
    ["data-results-asked", "asked"],
    ["data-results-story", "events"],
  ];
  return [...document.querySelectorAll(named.map(([attribute]) => `[${attribute}]`).join(", "))].map((node) => named.find(([attribute]) => node.hasAttribute(attribute))?.[1] ?? "?");
}

function sheetText(): string {
  return document.querySelector("[data-world-sheet='results']")?.textContent ?? "";
}

const AJO = "offer.join-ajo" as const;

/** The nurse with the ajo asked of her, and a month whose lines hold pay, rent, a paper come, a way heard of and the ask opened. */
function nurseMonth(): { view: PlayerView; lines: ReportLine[]; offer: string } {
  const game = newGame("scenario.nurse");
  const opened = openOffer(game, AJO);
  const lines = [
    line("line.wallet.salary", { amount: naira(18_000_000) }, "good"),
    line("line.wallet.rent", { amount: naira(2_000_000) }, "bad"),
    line("line.document.issued", { document: "document.passport" }, "good"),
    line("line.route.heard", { route: "route.uk-care", via: "news" }, "good"),
    line("line.offer.opened", { offer: AJO }),
    line("line.chapter.opened", { chapter: "chapter.build-the-file" }),
  ];
  const view = game.view();
  return { view: { ...view, setpiece: null, interview: null, report: { month: view.month, lines, japacityBefore: null, japacityAfter: null, attention: false } }, lines, offer: opened.id };
}

describe("the results lead with the money and the people", () => {
  test("[world:month-end-results-sheet] given a month with pay, rent, a paper come and an ask still open, when the results open, then the money comes first (payday, rent, Kept, the savings bar), then the faces asked of the player, then the month's events", async () => {
    const { view } = nurseMonth();
    const { store } = await renderWithView(<Results place="The family house" />, view);
    act(() => store.setState({ reportOpen: true, lastMonthLines: [] }));
    // A new nurse has no way out in play yet, so no savings bar.
    expect(parts()).toEqual(["payday", "rent", "kept", "asked", "events"]);
  });

  test("[world:month-end-results-sheet] given a life saving toward the move with asks open, when the results open, then the savings bar stands with the money, after Kept and before the faces", async () => {
    const lines = [line("line.wallet.salary", { amount: naira(18_000_000) }, "good"), line("line.document.issued", { document: "document.passport" }, "good")];
    const view: PlayerView = { ...richView(), setpiece: null, interview: null, report: { month: 4, lines, japacityBefore: null, japacityAfter: null, attention: false } };
    expect(view.offers.length).toBeGreaterThan(0);
    const { store } = await renderWithView(<Results place="Peckham" />, view);
    act(() => store.setState({ reportOpen: true, lastMonthLines: [] }));
    expect(parts()).toEqual(["payday", "kept", "savings", "asked", "events"]);
  });

  test("[world:month-end-results-sheet] given an ask still open at the month's end, when the results show it, then it is a face with the asker's name and the ask's own title, and no line says something new needs an answer", async () => {
    const { view, offer } = nurseMonth();
    const { store } = await renderWithView(<Results place="The family house" />, view);
    act(() => store.setState({ reportOpen: true, lastMonthLines: [] }));
    const face = document.querySelector<HTMLElement>(`[data-results-ask="${offer}"]`);
    expect(face).not.toBeNull();
    expect(face?.textContent).toContain(say(`${AJO}.who`));
    expect(face?.textContent).toContain(say(`${AJO}.title`));
    expect(face?.querySelector("[data-face-mark]")?.textContent).toBe("N");
    expect(sheetText()).not.toContain(words("line.offer.opened", { offer: AJO }));
    expect(sheetText()).not.toContain("needs an answer");
  });

  test("[world:month-end-results-sheet] given an ask's face on the results, when it is tapped, then the results close and that ask's card is asked for", async () => {
    const { view, offer } = nurseMonth();
    const onAsk = vi.fn();
    const { store } = await renderWithView(<Results place="The family house" onAsk={onAsk} />, view);
    act(() => store.setState({ reportOpen: true, lastMonthLines: [] }));
    const face = document.querySelector<HTMLElement>(`[data-results-ask="${offer}"]`);
    if (face === null) throw new Error("No face for the ask.");
    fireEvent.click(face);
    expect(onAsk).toHaveBeenCalledWith(offer);
    expect(store.getState().reportOpen).toBe(false);
  });

  test("[world:month-end-results-sheet] given a month with a paper come, a way heard of and a chapter opened, when the results show, then the paper is told and the rest lives in News only, with no line pointing to the phone", async () => {
    const { view } = nurseMonth();
    const { store } = await renderWithView(<Results place="The family house" />, view);
    act(() => store.setState({ reportOpen: true, lastMonthLines: [] }));
    const text = sheetText();
    expect(text).toContain(words("line.document.issued", { document: "document.passport" }));
    expect(text).not.toContain(words("line.route.heard", { route: "route.uk-care", via: "news" }));
    expect(text).not.toContain(words("line.chapter.opened", { chapter: "chapter.build-the-file" }));
    expect(text).not.toMatch(/on your phone|in News/);
  });

  test("[world:month-end-results-sheet] given the room on the water cleared away and pay in the same month, when the results show, then the clearing stands first and alone, before the money", async () => {
    const { view } = nurseMonth();
    const lines = [line("line.wallet.salary", { amount: naira(18_000_000) }, "good"), line("line.home.evicted-no-cash", { lost: naira(0) }, "bad", true), line("line.document.issued", { document: "document.passport" }, "good")];
    const { store } = await renderWithView(<Results place="Makoko" />, { ...view, report: { month: view.month, lines, japacityBefore: null, japacityAfter: null, attention: true } });
    act(() => store.setState({ reportOpen: true, lastMonthLines: [] }));
    expect(parts().filter((part) => part !== "savings" && part !== "asked")).toEqual(["events", "payday", "kept"]);
    expect(document.querySelector("[data-results-story] li")?.getAttribute("data-story-line")).toBe("line.home.evicted-no-cash");
  });
});

describe("what the results tell and what lives in News only", () => {
  const kept: ReportLine[] = [
    line("line.activity.job-started", { job: "activity.job-customer-service" }, "good"),
    line("line.activity.hunt-missed", { job: "activity.job-nurse" }),
    line("line.document.issued", { document: "document.passport" }, "good"),
    line("line.route.refused", { route: "route.uk-care", reason: "funds" }, "bad"),
    line("line.status.granted", { status: "status.uk-sponsored" }, "good"),
  ];
  const newsOnly: ReportLine[] = [
    line("line.route.heard", { route: "route.uk-care", via: "news" }, "good"),
    line("line.route.looked-into", { route: "route.uk-care" }),
    line("line.document.requested", { document: "document.passport", month: 4 }),
    line("line.route.applied", { route: "route.uk-care", month: 3 }),
    line("line.route.school-applied", { school: "school.northgate", month: 5 }),
    line("line.chapter.opened", { chapter: "chapter.build-the-file" }),
    line("line.goal.opened", { goal: "goal.first-car" }),
    line("line.setpiece.opened", { setpiece: "setpiece.credibility-interview", questions: 3 }),
    line("line.setpiece.closed", { setpiece: "setpiece.credibility-interview" }),
    line("line.offer.opened", { offer: AJO }),
    line("line.offer.taken", { offer: "offer.nepa-bill", choice: "pay" }),
    line("line.activity.hunt-hired", { job: "activity.job-customer-service" }, "good"),
  ];

  test("[world:month-end-results-sheet] given a month of events the player holds and events an act or a face already told, when the story is read, then only what changed what the player holds or answered what they started is told", () => {
    const told = storyLines([...newsOnly, ...kept]).map((each) => each.key);
    expect(told).toEqual(expect.arrayContaining(kept.map((each) => each.key)));
    for (const each of newsOnly) expect(told).not.toContain(each.key);
    expect(told.some((key) => key.startsWith("offer.nepa-bill.said."))).toBe(false);
  });

  test("[world:month-end-results-sheet] given an ask left to lapse into a choice at the month's end, when the story is read, then its own words are told, since nothing told it before", () => {
    const told = storyLines([line("line.offer.lapsed", { offer: "offer.nepa-bill", choice: "leave" }, "bad")]).map((each) => each.key);
    expect(told).toEqual(["offer.nepa-bill.said.leave"]);
  });
});
