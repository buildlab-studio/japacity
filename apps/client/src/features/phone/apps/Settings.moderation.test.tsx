// The team's two rows in the phone's Settings, the game's menu in the world (moderation:actioned-player-told-and-appeals,
// moderation:feedback-box-in-settings).
import type { Standing } from "@japacity/api";
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ModerationProvider } from "../../../shared/moderation/ModerationProvider";
import { words } from "../../../shared/moderation/moderation.words";
import { engineView } from "../../../shared/testing/fixtures";
import { fakeModeration } from "../../../shared/testing/moderation";
import { renderWithView } from "../../../shared/testing/render";
import { Settings } from "./Settings";

describe("the team's rows in Settings", () => {
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

  test("[moderation:feedback-box-in-settings] [moderation:actioned-player-told-and-appeals] given the game online, when the phone's Settings shows, then the feedback row is there, and the notice only once the team has decided something", async () => {
    const quiet = fakeModeration();
    await renderWithView(
      <ModerationProvider api={quiet}>
        <Settings />
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

  test("[moderation:actioned-player-told-and-appeals] given an action on the account, when the phone's Settings shows, then the notice row opens it", async () => {
    await renderWithView(
      <ModerationProvider api={fakeModeration({ standing: () => Promise.resolve({ ok: true, standing }) })}>
        <Settings />
      </ModerationProvider>,
      engineView(),
    );
    fireEvent.click(await screen.findByRole("button", { name: words("ui.notice") }));
    expect(await screen.findByRole("dialog", { name: words("ui.notice.title") })).toBeTruthy();
  });
});
