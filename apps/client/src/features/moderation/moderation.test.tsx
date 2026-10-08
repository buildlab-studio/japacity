import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import type { ServerRejection } from "../../shared/net/contract";
import type { ModerationApi } from "./api";
import { BlockReport, type BlockReportProps } from "./BlockReport";
import { REPORT_REASONS, type Standing } from "./contract";
import { FeedbackForm, ModerationMenu, NoticeView } from "./ModerationMenu";
import { ModerationProvider } from "./ModerationProvider";
import { reasonWords, words } from "./moderation.words";

const OK = { ok: true } as const;

function fakeModeration(over: Partial<ModerationApi> = {}): ModerationApi & { calls: string[] } {
  const calls: string[] = [];
  const log =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push(`${name}(${args.map((arg) => JSON.stringify(arg)).join(",")})`);
      return Promise.resolve(OK);
    };
  return {
    calls,
    block: log("block"),
    unblock: log("unblock"),
    report: log("report"),
    appeal: log("appeal"),
    feedback: log("feedback"),
    standing: () => Promise.resolve({ ok: true, standing: { actions: [], mutedUntil: null, suspendedUntil: null, banned: false, reports: [] } }),
    ...over,
  };
}

function control(moderation: ModerationApi | null, props: Partial<BlockReportProps> = {}) {
  return render(
    <ModerationProvider api={moderation}>
      <BlockReport who={{ account: "account.ada", name: "Ada" }} cites={{ messages: ["m.1", "m.2"] }} surface="conversation" {...props} />
    </ModerationProvider>,
  );
}

describe("the block and report control", () => {
  test("[R-PAIR-014] [R-MODERATION-001] [R-MODERATION-002] given another player, when block is tapped once, then they are blocked at once; tapping again lifts it", async () => {
    const moderation = fakeModeration();
    control(moderation);

    fireEvent.click(screen.getByRole("button", { name: words("ui.block") }));
    expect(await screen.findByText(words("ui.block.done"))).toBeTruthy();
    expect(moderation.calls).toEqual(['block("account.ada")']);

    fireEvent.click(screen.getByRole("button", { name: words("ui.block.undo") }));
    expect(await screen.findByText(words("ui.block.undone"))).toBeTruthy();
    expect(moderation.calls).toEqual(['block("account.ada")', 'unblock("account.ada")']);
  });

  test("[R-MODERATION-004] [R-MODERATION-006] [R-MODERATION-007] given a conversation, when report is tapped and a reason picked, then it sends the reason and the cited messages, blocks in the same step as ticked, and says it was received", async () => {
    const moderation = fakeModeration();
    control(moderation);

    fireEvent.click(screen.getByRole("button", { name: words("ui.report") }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("checkbox", { name: words("ui.report.also-block") })).toHaveProperty("checked", true);
    for (const reason of REPORT_REASONS) expect(within(sheet).getByRole("button", { name: reasonWords(reason) })).toBeTruthy();
    expect(within(sheet).queryByRole("textbox")).toBeNull();
    fireEvent.click(within(sheet).getByRole("button", { name: reasonWords("harassment") }));

    expect(await screen.findByText(words("ui.report.sent"))).toBeTruthy();
    expect(moderation.calls).toEqual(['report({"subject":{"account":"account.ada"},"reason":"harassment","cites":{"messages":["m.1","m.2"]}})', 'block("account.ada")']);
  });

  test("[R-MODERATION-006] given the block unticked, when a report is sent, then no block goes with it", async () => {
    const moderation = fakeModeration();
    control(moderation, { cites: { place: "place.market", phrase: "phrase.hello", at: 1_700 }, surface: "place-phrase" });

    fireEvent.click(screen.getByRole("button", { name: words("ui.report") }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("checkbox", { name: words("ui.report.also-block") }));
    fireEvent.click(within(sheet).getByRole("button", { name: reasonWords("scam") }));

    await waitFor(() => expect(moderation.calls).toEqual(['report({"subject":{"account":"account.ada"},"reason":"scam","cites":{"place":"place.market","phrase":"phrase.hello","at":1700}})']));
  });

  test("[R-MODERATION-004] given an advert, when its control is shown, then it reports the campaign and offers no block", async () => {
    const moderation = fakeModeration();
    control(moderation, { who: { campaign: "campaign.1", name: "This advert" }, cites: { campaign: "campaign.1", slot: "advert.slot-1" }, surface: "advert" });

    expect(screen.queryByRole("button", { name: words("ui.block") })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: words("ui.report") }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).queryByRole("checkbox")).toBeNull();
    fireEvent.click(within(sheet).getByRole("button", { name: reasonWords("advert") }));

    await waitFor(() => expect(moderation.calls).toEqual(['report({"subject":{"campaign":"campaign.1"},"reason":"advert","cites":{"campaign":"campaign.1","slot":"advert.slot-1"}})']));
  });

  test("[R-MODERATION-007] given a report the server refuses, when it is sent, then the player is told it did not go and nothing is blocked", async () => {
    const refusal: ServerRejection = { ok: false, code: "rate-limited", detail: "Too many.", retryAfter: 60 };
    const moderation = fakeModeration({ report: () => Promise.resolve(refusal) });
    control(moderation);

    fireEvent.click(screen.getByRole("button", { name: words("ui.report") }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: reasonWords("hate") }));

    expect(await screen.findByText(words("ui.report.failed"))).toBeTruthy();
    expect(moderation.calls).toEqual([]);
  });

  test("given no server, when the control would show, then there is nothing to block and nothing shows", () => {
    const { container } = control(null);
    expect(container.innerHTML).toBe("");
  });
});

describe("feedback", () => {
  function form(moderation: ModerationApi) {
    render(<FeedbackForm moderation={moderation} screen="home" max={500} />);
    const box = screen.getByRole("textbox", { name: words("ui.feedback.label") });
    const send = () => screen.getByRole("button", { name: words("ui.feedback.send") });
    return { box, send };
  }

  test("[R-MODERATION-020] given the box, when it holds nothing, 500 characters and 501, then send is off, on, and off again", () => {
    const { box, send } = form(fakeModeration());
    expect(send()).toHaveProperty("disabled", true);
    fireEvent.change(box, { target: { value: "😀".repeat(500) } });
    expect(send()).toHaveProperty("disabled", false);
    expect(screen.getByText(words("ui.feedback.count", { used: 500, max: 500 }))).toBeTruthy();
    fireEvent.change(box, { target: { value: "a".repeat(501) } });
    expect(send()).toHaveProperty("disabled", true);
  });

  test("[R-MODERATION-020] given a text, when it is sent, then it carries the build, the screen and the mode and nothing else, and the box empties", async () => {
    const moderation = fakeModeration();
    const { box, send } = form(moderation);
    fireEvent.change(box, { target: { value: "  The bus stop is lovely.  " } });
    fireEvent.click(send());

    expect(await screen.findByText(words("ui.feedback.sent"))).toBeTruthy();
    expect(moderation.calls).toEqual(['feedback({"text":"The bus stop is lovely.","build":"dev","screen":"home","mode":"high"})']);
    expect(box).toHaveProperty("value", "");
  });

  test("[R-MODERATION-020] given a sixth send in a day, when the server refuses it, then the player is told to send more tomorrow", async () => {
    const { box, send } = form(fakeModeration({ feedback: () => Promise.resolve({ ok: false, code: "rate-limited", detail: "At most 5 a day.", retryAfter: 100 }) }));
    fireEvent.change(box, { target: { value: "again" } });
    fireEvent.click(send());
    expect(await screen.findByText(words("ui.feedback.too-many"))).toBeTruthy();
  });
});

describe("the team's notice and the appeal", () => {
  const standing: Standing = {
    actions: [
      { entry: "log.1", action: "mute", reason: "harassment", at: Date.UTC(2026, 9, 8), until: Date.UTC(2026, 9, 15), appeal: null },
      { entry: "log.2", action: "warn", reason: "scam", at: Date.UTC(2026, 9, 1), until: null, appeal: { status: "decided", outcome: "upheld" } },
    ],
    mutedUntil: Date.UTC(2026, 9, 15),
    suspendedUntil: null,
    banned: false,
    reports: [{ id: "report.9", at: Date.UTC(2026, 9, 2), status: "decided", outcome: "no-action" }],
  };

  test("[R-MODERATION-016] given a mute and a decided appeal, when the notice shows, then it says the action, the reason and how to appeal; appealing sends the action once", async () => {
    const moderation = fakeModeration();
    let changed = 0;
    render(<NoticeView moderation={moderation} standing={standing} onChange={() => (changed += 1)} />);

    expect(screen.getByText(words("ui.notice.mute", { until: "15 Oct", reason: reasonWords("harassment").toLowerCase() }))).toBeTruthy();
    expect(screen.getByText(words("ui.notice.appeal.upheld"))).toBeTruthy();
    expect(screen.getAllByRole("button", { name: words("ui.notice.appeal") })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: words("ui.notice.appeal") }));

    await waitFor(() => expect(changed).toBe(1));
    expect(moderation.calls).toEqual(['appeal("log.1")']);
  });

  test("[R-MODERATION-007] given a decided report, when the notice shows, then it says the outcome and not what was done", () => {
    render(<NoticeView moderation={fakeModeration()} standing={{ ...standing, actions: [] }} onChange={() => undefined} />);
    expect(screen.getByText(words("ui.notice.report.no-action"))).toBeTruthy();
  });

  test("[R-MODERATION-020] [R-MODERATION-016] given the game online, when the menu shows, then the feedback button is there, and the notice only once the team has decided something", async () => {
    const quiet = fakeModeration();
    await renderWithView(
      <ModerationProvider api={quiet}>
        <ModerationMenu />
      </ModerationProvider>,
      engineView(),
    );
    expect(screen.getByRole("button", { name: words("ui.feedback") })).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole("button", { name: words("ui.notice") })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: words("ui.feedback") }));
    expect(await screen.findByRole("dialog", { name: words("ui.feedback.title") })).toBeTruthy();
  });

  test("[R-MODERATION-016] given an action on the account, when the menu shows, then the notice button opens it", async () => {
    await renderWithView(
      <ModerationProvider api={fakeModeration({ standing: () => Promise.resolve({ ok: true, standing }) })}>
        <ModerationMenu />
      </ModerationProvider>,
      engineView(),
    );
    fireEvent.click(await screen.findByRole("button", { name: words("ui.notice") }));
    expect(await screen.findByRole("dialog", { name: words("ui.notice.title") })).toBeTruthy();
  });
});
