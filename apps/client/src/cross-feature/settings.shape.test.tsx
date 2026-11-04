// The phone's Settings on a small phone (world:phone-rises-over-scene): one short screen that says each thing once. The
// line on when a graphics choice takes hold shows only once a choice is made; the team's rows stand in one card; About the
// game's rows, which other features hand in through the shell, stand in one card of their own.
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { CreditsRow } from "../features/city/Credits";
import { GuidesMenu } from "../features/guide/GuidesMenu";
import { Settings } from "../features/phone/apps/Settings";
import { ModerationProvider } from "../shared/moderation/ModerationProvider";
import { words } from "../shared/moderation/moderation.words";
import { engineView } from "../shared/testing/fixtures";
import { fakeModeration } from "../shared/testing/moderation";
import { renderWithView } from "../shared/testing/render";
import { say } from "../shared/words/text";

const decided = {
  actions: [{ entry: "log.1", action: "warn" as const, reason: "scam" as const, at: Date.UTC(2026, 9, 1), until: null, appeal: null }],
  mutedUntil: null,
  suspendedUntil: null,
  banned: false,
  reports: [],
};

describe("the phone's Settings", () => {
  test("[world:phone-rises-over-scene] [city:two-graphics-modes] given Settings opened, then the line on when a graphics choice takes hold waits until a choice is made", async () => {
    await renderWithView(<Settings />, engineView());
    expect(screen.queryByText(say("phone.settings.graphics.when"))).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: say("phone.settings.graphics.low") }));
    expect(screen.getByText(say("phone.settings.graphics.when"))).toBeDefined();
  });

  test("[world:phone-rises-over-scene] [moderation:feedback-box-in-settings] [moderation:actioned-player-told-and-appeals] [moderation:blocked-list-in-settings] given a secured account the team has acted on, then From the team, Feedback and Blocked stand as the rows of one card", async () => {
    await renderWithView(
      <ModerationProvider api={fakeModeration({ standing: () => Promise.resolve({ ok: true, standing: decided }) })}>
        <Settings secured />
      </ModerationProvider>,
      engineView(),
    );
    const notice = await screen.findByRole("button", { name: words("ui.notice") });
    const card = document.querySelector("[data-moderation-rows]");
    expect(card?.className).toMatch(/\blook-card\b/);
    const rows = [notice, screen.getByRole("button", { name: words("ui.feedback") }), screen.getByRole("button", { name: words("ui.blocked") })];
    for (const row of rows) {
      expect(card?.contains(row)).toBe(true);
      expect(row.className).not.toMatch(/\bphone-ghost\b/);
    }
  });

  test("[world:phone-rises-over-scene] [city:credits-screen-attributions] given About the game's rows handed in, then Credits and the guides stand as the rows of one card under its heading, each its name alone", async () => {
    await renderWithView(
      <Settings
        about={
          <>
            <CreditsRow />
            <GuidesMenu row />
          </>
        }
      />,
      engineView(),
    );
    const about = document.querySelector<HTMLElement>("[data-about]");
    expect(about?.className).toMatch(/\blook-card\b/);
    expect(about?.previousElementSibling?.textContent).toBe(say("phone.settings.about"));
    for (const row of [document.querySelector("[data-credits-row]"), document.querySelector("[data-guides-row]")]) {
      expect(row).not.toBeNull();
      expect(about?.contains(row)).toBe(true);
      expect(row?.className).not.toMatch(/\blook-card\b/);
    }
    expect(screen.queryByText(say("guide.page.game-note"))).toBeNull();
  });
});
