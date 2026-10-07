import { text } from "@japacity/content";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { nameOf, say, sayCount } from "../../shared/words/text";
import { TurnBar } from "./TurnBar";
import { TurnView } from "./TurnView";

const Turn = () => (
  <>
    <TurnView />
    <TurnBar />
  </>
);

describe("the month", () => {
  test("given a new life, then the month to plan and the turns banked come from the view", async () => {
    const view = engineView();
    await renderWithView(<Turn />, view);
    expect(screen.getByRole("heading", { name: say("ui.month.planning", { month: view.month + 1 }) })).toBeDefined();
    expect(screen.getAllByText(say("ui.month.banked", { banked: view.turns.banked, cap: view.turns.cap })).length).toBeGreaterThan(0);
    expect(screen.getByText(say("ui.month.slots", { used: 0, slots: view.freeSlots }))).toBeDefined();
  });

  test("given an empty plan, when the month is ended, then turn/end is sent with no slots on the view's version", async () => {
    const view = engineView();
    const { authority } = await renderWithView(<Turn />, view);
    fireEvent.click(screen.getByRole("button", { name: say("ui.month.end") }));
    await waitFor(() => expect(authority.sent).toEqual([{ type: "turn/end", slots: [], basedOn: view.v }]));
  });

  test("given last month's slots, when same again is used and the month ended, then the same slots are sent", async () => {
    const lastSlots = [{ activity: "activity.rest" as const, param: null }];
    const view = { ...engineView(), lastSlots };
    const { authority } = await renderWithView(<Turn />, view);
    fireEvent.click(screen.getByRole("button", { name: say("ui.month.same-again") }));
    expect(screen.getByText(say("ui.month.slots", { used: 1, slots: view.freeSlots }))).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.month.end") }));
    await waitFor(() => expect(authority.sent).toEqual([{ type: "turn/end", slots: lastSlots, basedOn: view.v }]));
  });

  test("given the authority rejects the month, then the rejection's words from content are shown", async () => {
    const { authority } = await renderWithView(<Turn />, engineView());
    authority.rejectNext({ code: "no-turns", detail: "No turn is banked." });
    fireEvent.click(screen.getByRole("button", { name: say("ui.month.end") }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(text["reject.no-turns"]);
  });

  test("given the interview is open, then the month cannot end and content says why", async () => {
    await renderWithView(<Turn />, richView());
    expect(screen.getByRole("button", { name: say("ui.month.end") }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(text["reject.setpiece-open"]!)).toBeDefined();
  });

  test("given a report, then its lines use content's words, attention lines are marked, and japacity moves", async () => {
    await renderWithView(<Turn />, richView());
    const closing = screen.getByText(text["chapter.find-your-feet.close"]!);
    expect(closing.closest("li")?.getAttribute("data-attention")).toBe("true");
    expect(screen.getByText(say("ui.report.needs-you"))).toBeDefined();
    // A line with words in content shows the words.
    expect(screen.getByText(/Salary paid/)).toBeDefined();
    // A key content has no words for yet shows as itself, so the gap is visible.
    expect(screen.getByText("line.test.not-written")).toBeDefined();
    expect(screen.getByText(say("ui.report.japacity", { before: "58%", after: "64%" }))).toBeDefined();
  });

  test("given a month just ended, then the report opens in a sheet", async () => {
    const { store } = await renderWithView(<Turn />, richView());
    store.getState().setReportOpen(true);
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText(text["chapter.find-your-feet.close"]!)).toBeDefined();
  });

  test("given a month played at rest, when same again is used, then rest is planned in every slot", async () => {
    const view = { ...engineView(), lastSlots: [], report: { month: 1, lines: [], japacityBefore: null, japacityAfter: null, attention: false } };
    const { store } = await renderWithView(<Turn />, view);
    fireEvent.click(screen.getByRole("button", { name: say("ui.month.same-again") }));
    expect(store.getState().plan).toEqual(Array.from({ length: view.freeSlots }, () => ({ activity: "activity.rest", param: null })));
  });

  test("given japacity appears for the first time, then the report says the figure, not no route to it", async () => {
    const rich = richView();
    await renderWithView(<Turn />, { ...rich, report: { ...rich.report!, japacityBefore: null, japacityAfter: 14 } });
    expect(screen.getByText(say("ui.report.japacity-first", { after: "14%" }))).toBeDefined();
    expect(screen.queryByText(/No route yet to/)).toBeNull();
  });

  test("given no route before or after, then the report says no route yet once", async () => {
    const rich = richView();
    await renderWithView(<Turn />, { ...rich, report: { ...rich.report!, japacityBefore: null, japacityAfter: null } });
    expect(screen.getByText(say("ui.report.japacity-none"))).toBeDefined();
  });

  test("given a split payment and a doubled salary, then the report shows one line for each", async () => {
    const rich = richView();
    const lines = [
      { key: "line.wallet.salary", params: { currency: "NGN", amount: 7_500_000 }, tone: "good" as const, attention: false, counts: [] },
      { key: "line.activity.salary", params: { job: "activity.job-teacher", currency: "NGN", amount: 7_500_000 }, tone: "good" as const, attention: false, counts: [] },
      { key: "line.wallet.upkeep", params: { currency: "NGN", amount: 5_305_951 }, tone: "bad" as const, attention: false, counts: [] },
      { key: "line.wallet.upkeep", params: { currency: "NGN", amount: 4_194_049 }, tone: "bad" as const, attention: false, counts: [] },
    ];
    await renderWithView(<TurnView />, { ...rich, report: { ...rich.report!, lines } });
    expect(screen.getAllByText(/^Salary/)).toHaveLength(1);
    expect(screen.getAllByText(new RegExp(`^${text["line.wallet.upkeep"]!.split(":")[0]!}`))).toHaveLength(1);
    expect(screen.getByText(/₦95,000/)).toBeDefined();
  });

  test("given a paper about to run out, then the month warns before it does", async () => {
    const rich = richView();
    const documents = [{ id: "document.tb-certificate" as const, state: "held" as const, readyMonth: null, expiresMonth: rich.month + 1, value: null }];
    await renderWithView(<Turn />, { ...rich, documents });
    expect(screen.getByText(say("ui.month.expiring"))).toBeDefined();
    expect(screen.getByText(sayCount("ui.month.expiring.item", 1, { document: nameOf("document.tb-certificate"), months: 1, month: rich.month + 1 }))).toBeDefined();
  });
});
