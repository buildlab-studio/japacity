// Words that misled players in the whole-life review, each held to what it should say.
import { content, text } from "@japacity/content";
import type { ActivityOption, PlayerView, ReportLine } from "@japacity/sim";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ActivityView } from "../../features/activity/ActivityView";
import { Bills } from "../../features/phone/apps/Bills";
import { Japa } from "../../features/phone/apps/Japa";
import { DECEMBER } from "../../features/setpiece/DecemberScene";
import { nudgeOf } from "../../features/city/nudge";
import { engineView, richView } from "../testing/fixtures";
import { renderWithView } from "../testing/render";
import { ReportLines } from "../ui/ReportLines";
import { asksAttention, tidyLines } from "./lines";
import { paramWords, say, sayCount, words } from "./text";
import { uiText } from "./ui";

const LOTTO = "activity.play-lotto";

function line(key: string, params: ReportLine["params"], attention = false): ReportLine {
  return { key, params, tone: "plain", attention, counts: [] };
}

describe("words that mislead", () => {
  test("[R-LUCK-005] given the kiosk, when tickets are picked, then the picker and the plan say 1 ticket to 5 tickets, never a bare key", async () => {
    const base = engineView();
    const kiosk = base.activities.find((option) => option.id === LOTTO);
    if (kiosk === undefined) throw new Error("No kiosk in a new life.");
    const counts = kiosk.params ?? [];
    expect(counts).toEqual(Array.from({ length: content.tuning.luck.maxTickets }, (_, index) => String(index + 1)));
    const { store, authority } = await renderWithView(<ActivityView />, { ...base, activities: [kiosk] satisfies ActivityOption[] });
    const picker = screen.getByLabelText(say("ui.activity.pick"));
    expect(within(picker).getAllByRole("option").map((option) => option.textContent)).toEqual(counts.map((count) => sayCount("ui.activity.tickets", Number(count), { count: Number(count) })));
    expect(within(picker).getByRole("option", { name: "1 ticket" })).toBeDefined();
    expect(within(picker).getByRole("option", { name: "5 tickets" })).toBeDefined();
    expect(document.body.textContent).not.toMatch(/\d\.name/);
    fireEvent.change(picker, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: `${text[`${LOTTO}.name`] ?? LOTTO}` }));
    // the kiosk sells at once, so the count picked goes with the command sent now and the
    // month's plan holds no ticket; the count is said in words where it is picked.
    await waitFor(() => expect(authority.sent.at(-1)).toMatchObject({ type: "activity/now", activity: LOTTO, param: "3" }));
    expect(store.getState().plan.some((pick) => pick?.activity === LOTTO)).toBe(false);
    expect(paramWords("3")).toBe("3 tickets");
  });

  test("[R-ROUTE-019] given a refusal for the sponsor, the agent or the endorsement, then each reason is said in words", async () => {
    const base = richView();
    const reasons = ["sponsor", "agent", "endorsement"];
    const routes = base.routes.map((route) => (route.lastRefusal === null ? route : { ...route, lastRefusal: { ...route.lastRefusal, reasons } }));
    // Moved from the old month page's route cards to Japa's way files: the reasons under the last refusal.
    await renderWithView(<Japa />, { ...base, routes });
    for (const reason of reasons) {
      expect(uiText[`ui.refusal.${reason}`]).toBeDefined();
      const shown = Array.from(document.querySelectorAll(`[data-refusal-reason="${reason}"]`)).map((item) => item.textContent);
      expect(shown.length).toBeGreaterThan(0);
      for (const words_ of shown) expect(words_).toBe(say(`ui.refusal.${reason}`));
    }
  });

  test("[R-OBLIGATION-003] given a count of one in a line or a panel, then it reads 1 month, 1 question and 1 payment, never 1 months", async () => {
    // the questions are to answer, never waiting.
    expect(words("line.setpiece.opened", { setpiece: "setpiece.road-truth", questions: 1 })).toContain("1 question to answer");
    expect(words("line.setpiece.opened", { setpiece: "setpiece.road-truth", questions: 2 })).toContain("2 questions to answer");
    expect(words("line.status.clock-ran", { months: 1 })).toBe("1 month left on the clock.");
    // the kiosk's draw is said as the outcome, the ticket's price told on its own line.
    expect(words("line.activity.lotto-lost", { tickets: 1, stake: { currency: "NGN", amount: 20_000 } })).toBe("Your ticket did not win.");
    expect(words("line.activity.lotto-lost", { tickets: 3, stake: { currency: "NGN", amount: 60_000 } })).toBe("Your 3 tickets did not win.");

    const base = richView();
    const loan = base.obligations.find((owed) => owed.missed > 0);
    if (loan === undefined) throw new Error("The rich view has no missed payment.");
    const obligations = base.obligations.map((owed) => (owed === loan ? { ...owed, monthsLeft: 1, missed: 1 } : owed));
    // Moved from the old obligations panel to the phone's Bills.
    await renderWithView(<Bills />, { ...base, obligations } satisfies PlayerView);
    expect(screen.getByText("1 month left")).toBeDefined();
    expect(screen.getByText("Missed 1 payment in a row")).toBeDefined();
    expect(document.body.textContent).not.toMatch(/\b1 (months|questions|payments)\b/);
  });

  // The month's report shows in the world's results and its lines in the road's, the offers' and the prologue's lists
  // (ReportLines); whether a month needs an answer is the one test the world's nudge reads (nudge.ts, asksAttention).
  test("[R-NEWS-005] [R-TURN-008] given a month whose only marked line is a story for you, then its line is tagged for you and nothing says it needs an answer", async () => {
    const base = engineView();
    const story = line("line.news.delivered", { story: "news.era-calm", stage: "announced", forYou: 1 }, true);
    const report = { month: 1, lines: [story], japacityBefore: null, japacityAfter: null, attention: true };
    await renderWithView(<ReportLines lines={report.lines} />, { ...base, report });
    expect(tidyLines(report.lines).some(asksAttention)).toBe(false);
    expect(nudgeOf({ ...base, report, chapter: { ...base.chapter, current: null }, offers: [], setpiece: null }).key).not.toBe("ui.nudge.report");
    expect(screen.getByText(say("ui.news.for-you"))).toBeDefined();
  });

  test("[R-TURN-008] given a set piece open and last month's lines asking nothing, then nothing says something needs an answer", () => {
    const base = engineView();
    const played = line("line.activity.played", { activity: "activity.rest" }, false);
    const report = { month: 1, lines: [played], japacityBefore: null, japacityAfter: null, attention: false };
    const setpiece = { entry: DECEMBER, asked: 0, total: 1, question: null };
    expect(tidyLines(report.lines).some(asksAttention)).toBe(false);
    expect(nudgeOf({ ...base, report, setpiece, chapter: { ...base.chapter, current: null }, offers: [] } satisfies PlayerView).key).not.toBe("ui.nudge.report");
  });

  test("[R-TURN-008] given a month where an offer opened, then the report still says something needs an answer", () => {
    const base = engineView();
    const opened = line("line.offer.opened", { offer: "offer.roof" }, true);
    const report = { month: 1, lines: [opened], japacityBefore: null, japacityAfter: null, attention: true };
    expect(tidyLines(report.lines).some(asksAttention)).toBe(true);
    expect(nudgeOf({ ...base, report, chapter: { ...base.chapter, current: null }, offers: [], setpiece: null }).key).toBe("ui.nudge.report");
  });

  // The month bar went with the old page; the world says the engine's words where the month would turn, at the bed
  // (features/city/City.interview.test.tsx holds the December visit and the road's night there).
  test("[R-SETPIECE-002] given the interface's own words, then it says interview only of a refusal", () => {
    const own = Object.entries(uiText).filter(([key, value]) => /interview/i.test(value) && !key.startsWith("ui.refusal."));
    expect(own).toEqual([]);
  });
});
