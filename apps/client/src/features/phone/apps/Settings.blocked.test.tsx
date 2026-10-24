// The Blocked list in the phone's Settings (moderation:blocked-list-in-settings): every account the player blocked,
// newest first, each with its face from the shown name, its username, the day and an Unblock button.
import type { BlockedLine, BlockedListReply } from "@japacity/api";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { lookForName } from "../../../shared/front-door/looks";
import { ModerationProvider } from "../../../shared/moderation/ModerationProvider";
import type { ModerationApi } from "../../../shared/moderation/api";
import { words } from "../../../shared/moderation/moderation.words";
import { engineView } from "../../../shared/testing/fixtures";
import { fakeModeration } from "../../../shared/testing/moderation";
import { renderWithView } from "../../../shared/testing/render";
import { Settings } from "./Settings";

// Midday in UTC, so the day reads the same in any time zone the tests run in.
const LINES: BlockedLine[] = [
  { account: "account-c", username: "kemi_b", at: Date.UTC(2026, 9, 22, 12) },
  { account: "account-gone", username: null, at: Date.UTC(2026, 9, 20, 12) },
  { account: "account-b", username: "tunde_k", at: Date.UTC(2026, 6, 3, 12) },
];

function listed(blocked: BlockedLine[] = LINES): () => Promise<BlockedListReply> {
  return () => Promise.resolve({ ok: true, blocked });
}

async function openList(api: ModerationApi): Promise<HTMLElement> {
  await renderWithView(
    <ModerationProvider api={api}>
      <Settings secured />
    </ModerationProvider>,
    engineView(),
  );
  fireEvent.click(screen.getByRole("button", { name: words("ui.blocked") }));
  return screen.findByRole("dialog", { name: words("ui.blocked") });
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("the Blocked list in Settings", () => {
  test("[moderation:blocked-list-in-settings] given three accounts blocked, when the list opens, then each line shows its face from the shown name, its username, the day of the block and an Unblock button, newest first, and a gone account reads as a player", async () => {
    const sheet = await openList(fakeModeration({ blocked: listed() }));

    const lines = await within(sheet).findAllByRole("listitem");
    expect(lines.map((line) => line.querySelector("[data-blocked-name]")?.textContent)).toEqual(["kemi_b", words("ui.blocked.someone"), "tunde_k"]);
    expect(lines.map((line) => line.querySelector("[data-face-sticker]")?.getAttribute("data-face-sticker"))).toEqual([lookForName("kemi_b"), lookForName(words("ui.blocked.someone")), lookForName("tunde_k")]);
    expect(lines.map((line) => line.querySelector("[data-blocked-day]")?.textContent)).toEqual([
      words("ui.blocked.day", { day: "22 Oct" }),
      words("ui.blocked.day", { day: "20 Oct" }),
      words("ui.blocked.day", { day: "3 Jul" }),
    ]);
    for (const [line, name] of [
      [lines[0], "kemi_b"],
      [lines[2], "tunde_k"],
    ] as const) {
      expect(within(line as HTMLElement).getByRole("button", { name: words("ui.blocked.unblock", { name }) })).toBeTruthy();
    }
    // Dressed as the boards' lines: each a card.
    for (const line of lines) expect(line.className).toContain("look-card");
  });

  test("[moderation:blocked-list-in-settings] given a line, when Unblock is pressed, then the account on that line is unblocked and the line goes from the list", async () => {
    const api = fakeModeration({ blocked: listed() });
    const sheet = await openList(api);

    fireEvent.click(await within(sheet).findByRole("button", { name: words("ui.blocked.unblock", { name: "tunde_k" }) }));
    await settle();

    expect(api.calls).toContain(`unblock(${JSON.stringify({ account: "account-b" })})`);
    expect(within(sheet).getAllByRole("listitem").map((line) => line.querySelector("[data-blocked-name]")?.textContent)).toEqual(["kemi_b", words("ui.blocked.someone")]);
    expect(within(sheet).getByRole("status").textContent).toBe(words("ui.block.undone"));
  });

  test("[moderation:blocked-list-in-settings] given an unblock the server refuses, when Unblock is pressed, then the line stays and the sheet says it did not go", async () => {
    const api = fakeModeration({ blocked: listed(), unblock: () => Promise.resolve({ ok: false, code: "not-legal", detail: "The server could not be reached." }) });
    const sheet = await openList(api);

    fireEvent.click(await within(sheet).findByRole("button", { name: words("ui.blocked.unblock", { name: "kemi_b" }) }));
    await settle();

    expect(within(sheet).getAllByRole("listitem")).toHaveLength(3);
    expect(within(sheet).getByRole("alert").textContent).toBe(words("ui.blocked.unblock.failed"));
  });

  test("[moderation:blocked-list-in-settings] given no one blocked, when the list opens, then it says so in one line", async () => {
    const sheet = await openList(fakeModeration({ blocked: listed([]) }));

    expect(await within(sheet).findByText(words("ui.blocked.none"))).toBeTruthy();
    expect(within(sheet).queryAllByRole("listitem")).toEqual([]);
  });

  test("[moderation:blocked-list-in-settings] given a list that fails to load, when the list opens, then it says the list did not load and offers to try again, which loads it", async () => {
    let asked = 0;
    const sheet = await openList(
      fakeModeration({
        blocked: () => {
          asked += 1;
          return asked === 1 ? Promise.resolve({ ok: false, code: "not-legal", detail: "The server could not be reached." }) : listed()();
        },
      }),
    );

    expect(await within(sheet).findByText(words("ui.blocked.failed"))).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: words("ui.blocked.retry") }));
    expect(await within(sheet).findAllByRole("listitem")).toHaveLength(3);
  });

  test("[moderation:blocked-list-in-settings] given the game offline, or a guest's life, when Settings shows, then there is no Blocked row", async () => {
    await renderWithView(
      <ModerationProvider api={null}>
        <Settings secured />
      </ModerationProvider>,
      engineView(),
    );
    expect(screen.queryByRole("button", { name: words("ui.blocked") })).toBeNull();
    cleanup();

    await renderWithView(
      <ModerationProvider api={fakeModeration({ blocked: listed() })}>
        <Settings />
      </ModerationProvider>,
      engineView(),
    );
    expect(screen.queryByRole("button", { name: words("ui.blocked") })).toBeNull();
  });
});

describe("the Blocked list while it loads (world:reach-and-read)", () => {
  test("[world:reach-and-read] given the list not yet answered, when it opens, then it shows the shared loader, never an empty sheet", async () => {
    const sheet = await openList(fakeModeration({ blocked: () => new Promise<BlockedListReply>(() => undefined) }));
    await settle();
    expect(within(sheet).getByRole("progressbar", { name: words("ui.blocked.loading") })).toBeDefined();
  });
});
