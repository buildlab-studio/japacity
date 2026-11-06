// The nurse's first miss, as the results and the lead's sheet tell it (activity:missed-hunt-opens-a-lead): the month says the
// ward came to nothing, then Lanre's lead names the call centre and says it will not count for the wards, and the sheet
// says so above Take it. Played from the nurse's tile on the real content.
import type { ReportLine } from "@japacity/sim";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { OfferView } from "../features/offer/OfferView";
import { storyLines } from "../features/turn/month.results";
import { renderWithView } from "../shared/testing/render";
import { tileNurse } from "../shared/testing/nurse";
import { toldOnResults } from "../shared/words/told";
import { say, words } from "../shared/words/text";
import type { Game } from "@japacity/sim/testing";

const HUNT = "activity.job-hunt";
const NURSE = "activity.job-nurse";

/** The nurse's tile whose first hunt for the ward missed, and that month's lines. */
function nurseMissed(): { game: Game; lines: ReportLine[] } {
  for (let at = 0; at < 80; at += 1) {
    const game = tileNurse(`lead-nurse-${String(at)}`);
    const { lines } = game.endTurn([{ activity: HUNT, param: NURSE } as never]);
    if (lines.some((line) => line.key === "line.activity.hunt-missed" && line.params["job"] === NURSE)) return { game, lines };
  }
  throw new Error("No seed of 80 missed the ward.");
}

describe("the nurse's lead", () => {
  test("[activity:missed-hunt-opens-a-lead] [world:month-end-results-sheet] given the nurse's first hunt for the ward missed, when the month's results are read, then the miss is told and then Lanre's lead naming the call centre in Ikeja and that it will not count for the wards", () => {
    const { game, lines } = nurseMissed();
    const story = storyLines(lines).map((line) => toldOnResults(line, game.view()));
    const keys = story.map((line) => line.key);
    expect(keys.indexOf("ui.results.hunt-missed")).toBeGreaterThanOrEqual(0);
    expect(keys.indexOf("line.activity.hunt-lead")).toBe(keys.indexOf("ui.results.hunt-missed") + 1);
    const lead = story.find((line) => line.key === "line.activity.hunt-lead")!;
    expect(words(lead.key, lead.params)).toBe("Lanre told you about a call centre in Ikeja that is hiring: it pays, but it will not count for the wards.");
    expect(story.some((line) => line.key === "line.offer.opened")).toBe(false);
  });

  test("[activity:missed-hunt-opens-a-lead] [text:voice-by-surface] given the nurse's lead open, when its sheet shows, then Lanre asks, the line names the place and the cost above Take it and Keep looking, and nothing says the job is sure", async () => {
    const { game } = nurseMissed();
    const view = game.view();
    const offer = view.offers.find((open) => open.entry === "offer.job-lead");
    expect(offer).toBeDefined();
    await renderWithView(<OfferView only={(open) => open.id === offer!.id} />, view);
    const card = document.querySelector("[data-ask='offer.job-lead']")!;
    expect(card.querySelector("[data-ask-title]")?.textContent).toBe(say("offer.job-lead.title"));
    expect(card.textContent).toContain("Lanre");
    const body = screen.getByText("“I know a call centre in Ikeja that is hiring: it pays, but it will not count for the wards.”");
    const take = screen.getByRole("button", { name: new RegExp(`^${say("offer.job-lead.choice.accept")}`) });
    const keep = screen.getByRole("button", { name: new RegExp(`^${say("offer.job-lead.choice.decline")}`) });
    expect(body.compareDocumentPosition(take) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(take.compareDocumentPosition(keep) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(card.textContent).not.toMatch(/\b(sure|certain|guarantee)/i);
  });
});
