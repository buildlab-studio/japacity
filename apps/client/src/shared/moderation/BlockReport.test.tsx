import { REPORT_REASONS, type ServerRejection } from "@japacity/api";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { fakeModeration } from "../testing/moderation";
import "../testing/render";
import type { ModerationApi } from "./api";
import { BlockReport, reportBody, type BlockReportProps } from "./BlockReport";
import { ModerationProvider } from "./ModerationProvider";
import { reasonWords, words } from "./moderation.words";

function control(moderation: ModerationApi | null, props: Partial<BlockReportProps> = {}) {
  return render(
    <ModerationProvider api={moderation}>
      <BlockReport who={{ pair: "pair-1", name: "Ada" }} cites={{ messages: ["m.1", "m.2"] }} surface="conversation" {...props} />
    </ModerationProvider>,
  );
}

describe("the block and report control", () => {
  test("[R-PAIR-014] [R-MODERATION-001] [R-MODERATION-002] given another player, when block is tapped once, then they are blocked by their pair at once; tapping again lifts it", async () => {
    const moderation = fakeModeration();
    control(moderation);

    fireEvent.click(screen.getByRole("button", { name: words("ui.block") }));
    expect(await screen.findByText(words("ui.block.done"))).toBeTruthy();
    expect(moderation.calls).toEqual(['block({"pair":"pair-1"})']);

    fireEvent.click(screen.getByRole("button", { name: words("ui.block.undo") }));
    expect(await screen.findByText(words("ui.block.undone"))).toBeTruthy();
    expect(moderation.calls).toEqual(['block({"pair":"pair-1"})', 'unblock({"pair":"pair-1"})']);
  });

  test("[R-PAIR-016] [R-MODERATION-004] [R-MODERATION-006] [R-MODERATION-007] given a conversation, when report is tapped and a reason picked, then one request cites the pair and the messages and blocks in the same step as ticked, and says it was received", async () => {
    const moderation = fakeModeration();
    let blocked = 0;
    control(moderation, { onBlocked: () => (blocked += 1) });

    fireEvent.click(screen.getByRole("button", { name: words("ui.report") }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("checkbox", { name: words("ui.report.also-block") })).toHaveProperty("checked", true);
    for (const reason of REPORT_REASONS.filter((each) => each !== "advert")) expect(within(sheet).getByRole("button", { name: reasonWords(reason) })).toBeTruthy();
    expect(within(sheet).queryByRole("button", { name: reasonWords("advert") })).toBeNull();
    expect(within(sheet).queryByRole("textbox")).toBeNull();
    fireEvent.click(within(sheet).getByRole("button", { name: reasonWords("harassment") }));

    expect(await screen.findByText(words("ui.report.sent"))).toBeTruthy();
    expect(moderation.calls).toEqual(['report({"pair":"pair-1","reason":"harassment","messages":["m.1","m.2"],"block":true})']);
    expect(blocked).toBe(1);
  });

  test("[R-MODERATION-006] given the block unticked on a pair record, when a report is sent, then it cites the pair with no messages and no block", async () => {
    const moderation = fakeModeration();
    control(moderation, { cites: { pair: "pair-1" }, surface: "pair" });

    fireEvent.click(screen.getByRole("button", { name: words("ui.report") }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("checkbox", { name: words("ui.report.also-block") }));
    fireEvent.click(within(sheet).getByRole("button", { name: reasonWords("scam") }));

    await waitFor(() => expect(moderation.calls).toEqual(['report({"pair":"pair-1","reason":"scam","block":false})']));
  });

  test("[R-MODERATION-005] given a phrase heard in a place, when it is reported, then it cites the place, the phrase and the time, and offers no block", async () => {
    const moderation = fakeModeration();
    control(moderation, { who: { name: "Ada" }, cites: { place: "place.ojuelegba", phrase: "phrase.hello", at: 1_700 }, surface: "place-phrase" });

    expect(screen.queryByRole("button", { name: words("ui.block") })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: words("ui.report") }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).queryByRole("checkbox")).toBeNull();
    fireEvent.click(within(sheet).getByRole("button", { name: reasonWords("scam") }));

    await waitFor(() => expect(moderation.calls).toEqual(['report({"reason":"scam","cites":{"place":"place.ojuelegba","phrase":"phrase.hello","at":1700}})']));
  });

  test("[R-MODERATION-004] given an advert, when its control is shown, then it reports the campaign and offers no block", async () => {
    const moderation = fakeModeration();
    control(moderation, { who: { campaign: "campaign.1", name: "This advert" }, cites: { campaign: "campaign.1", slot: "advert.phone-tile" }, surface: "advert" });

    expect(screen.queryByRole("button", { name: words("ui.block") })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: words("ui.report") }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).queryByRole("checkbox")).toBeNull();
    fireEvent.click(within(sheet).getByRole("button", { name: reasonWords("advert") }));

    await waitFor(() => expect(moderation.calls).toEqual(['report({"subject":{"campaign":"campaign.1"},"reason":"advert","cites":{"campaign":"campaign.1","slot":"advert.phone-tile"}})']));
  });

  test("[R-MODERATION-007] given a report the server refuses, when it is sent, then the player is told it did not go and nothing is blocked", async () => {
    const refusal: ServerRejection = { ok: false, code: "rate-limited", detail: "Too many.", retryAfter: 60 };
    const moderation = fakeModeration({ report: () => Promise.resolve(refusal) });
    control(moderation);

    fireEvent.click(screen.getByRole("button", { name: words("ui.report") }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: reasonWords("hate") }));

    expect(await screen.findByText(words("ui.report.failed"))).toBeTruthy();
    expect(screen.getByRole("button", { name: words("ui.block") })).toBeTruthy();
  });

  test("given no server, when the control would show, then there is nothing to block and nothing shows", () => {
    const { container } = control(null);
    expect(container.innerHTML).toBe("");
  });
});

describe("the report route's cite form", () => {
  test("[R-MODERATION-004] given a card or a phrase heard in a place, when it is reported, then the body names no subject for the server to find; an advert names its campaign", () => {
    expect(reportBody({ name: "Tunde" }, { card: "4f1e2d3c" }, "scam", false)).toEqual({ reason: "scam", cites: { card: "4f1e2d3c" } });
    const heard = { place: "place.ojuelegba", phrase: "phrase.hello", at: 5 };
    expect(reportBody({ name: "Someone" }, heard, "harassment", false)).toEqual({ reason: "harassment", cites: heard });
    const slot = { campaign: "campaign-1", slot: "advert.billboard" };
    expect(reportBody({ campaign: "campaign-1", name: "Mama Put" }, slot, "advert", false)).toEqual({ subject: { campaign: "campaign-1" }, reason: "advert", cites: slot });
  });
});
