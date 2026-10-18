// The team's corner (moderation:reporter-told-outcome-only, moderation:actioned-player-told-and-appeals, moderation:feedback-box-in-settings): the feedback box and the notice. Their two rows in the phone's Settings
// are features/phone/apps/Settings.moderation.test.tsx.
import type { Standing } from "@japacity/api";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { setGraphicsMode } from "../graphics/mode";
import type { ModerationApi } from "./api";
import { reasonWords, words } from "./moderation.words";
import { fakeModeration } from "../testing/moderation";
import "../testing/render";
import { FeedbackForm, NoticeView } from "./Feedback";

describe("feedback", () => {
  function form(moderation: ModerationApi) {
    render(<FeedbackForm moderation={moderation} screen="home" max={500} />);
    const box = screen.getByRole("textbox", { name: words("ui.feedback.label") });
    const send = () => screen.getByRole("button", { name: words("ui.feedback.send") });
    return { box, send };
  }

  test("[moderation:feedback-box-in-settings] given the box, when it holds nothing, 500 characters and 501, then send is off, on, and off again", () => {
    const { box, send } = form(fakeModeration());
    expect(send()).toHaveProperty("disabled", true);
    fireEvent.change(box, { target: { value: "😀".repeat(500) } });
    expect(send()).toHaveProperty("disabled", false);
    expect(screen.getByText(words("ui.feedback.count", { used: 500, max: 500 }))).toBeTruthy();
    fireEvent.change(box, { target: { value: "a".repeat(501) } });
    expect(send()).toHaveProperty("disabled", true);
  });

  test("[moderation:feedback-box-in-settings] given a text, when it is sent, then it carries the build, the screen and the city's graphics mode and nothing else, and the box empties", async () => {
    for (const mode of ["high", "low"] as const) {
      setGraphicsMode(mode);
      const moderation = fakeModeration();
      const { box, send } = form(moderation);
      fireEvent.change(box, { target: { value: "  The bus stop is lovely.  " } });
      fireEvent.click(send());

      expect(await screen.findByText(words("ui.feedback.sent"))).toBeTruthy();
      expect(moderation.calls).toEqual([`feedback({"text":"The bus stop is lovely.","build":"dev","screen":"home","mode":"${mode}"})`]);
      expect(box).toHaveProperty("value", "");
      cleanup();
    }
  });

  test("[moderation:feedback-box-in-settings] given a sixth send in a day, when the server refuses it, then the player is told to send more tomorrow", async () => {
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

  test("[moderation:actioned-player-told-and-appeals] given a mute and a decided appeal, when the notice shows, then it says the action, the reason and how to appeal; appealing sends the action once", async () => {
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

  test("[moderation:reporter-told-outcome-only] given a decided report, when the notice shows, then it says the outcome and not what was done", () => {
    render(<NoticeView moderation={fakeModeration()} standing={{ ...standing, actions: [] }} onChange={() => undefined} />);
    expect(screen.getByText(words("ui.notice.report.no-action"))).toBeTruthy();
  });
});
