// The moment card over the month's results (docs/rules/moments.md R-MOMENT-006): the sheet and the card are two
// features, put together by the shell as App.tsx does, so the test that sees both lives beside the shell.
import type { PlayerView, ReportLine } from "@japacity/sim";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "./authority/GameProvider";
import type { PlayerCommand } from "./authority/store";
import { createGameStore } from "./authority/store";
import { gallery } from "./features/card/gallery";
import { CardView } from "./features/card/ShareCard";
import { MomentCard } from "./features/moment/MomentCard";
import { Results } from "./features/turn/Results";
import { engineView, gameAuthority, recordedGame, recordedSave } from "./shared/testing/fixtures";
import { renderWithView } from "./shared/testing/render";
import { cardKey } from "./shared/ui/stage";
import { say } from "./shared/words/text";

// Decision 0013: the lives were re-recorded; Ada's month that closes her chapter on building the file is now her 228th command.
const CLOSE = 227;

const REFUSED: ReportLine = { key: "line.route.refused", params: { route: "route.uk-masters", reason: "interview" }, tone: "bad", attention: true, counts: [] };

/** A recorded command as the screen sends it: the store fills in the version it is based on. */
function recordedCommand(recorded: unknown): PlayerCommand {
  const command = { ...(recorded as PlayerCommand & { basedOn?: number }) };
  delete command.basedOn;
  return command;
}

/** A view with a month's report, so the results sheet has something to show. */
function reportedView(): PlayerView {
  const view = engineView();
  return { ...view, report: { month: 1, lines: [], japacityBefore: null, japacityAfter: null, attention: false } };
}

describe("the moment card over the results", () => {
  test("[R-MOMENT-006] given a month whose report holds a refusal, when the results sheet is up, then the card stands over it, and one tap on it leaves the sheet as it was", async () => {
    const { store, authority } = await renderWithView(
      <>
        <Results place="the family house" foot={<MomentCard over="results" />} />
        <MomentCard over="world" />
      </>,
      reportedView(),
    );
    authority.linesNext([REFUSED]);
    await act(() => store.getState().endMonth());
    await waitFor(() => expect(document.querySelector("[data-world-sheet='results']")).not.toBeNull());
    const card = await screen.findByRole("dialog", { name: say("moment.refused.kicker") });
    fireEvent.click(card.querySelector("[data-moment-card]")!);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: say("moment.refused.kicker") })).toBeNull());
    expect(document.querySelector("[data-world-sheet='results']")).not.toBeNull();
    expect(store.getState().reportOpen).toBe(true);
    expect(store.getState().momentCards).toEqual([]);
  });


  // A chapter's close is told once: by the results line and the moment card, never again by its share card.
  test("[R-MOMENT-006] [R-SHARE-001] given Ada's month that closes a chapter (her recorded life), when the moment card has told it over the results, then the chapter's share card never opens after it, and it is kept in the gallery", async () => {
    const save = recordedSave("ada-careful");
    const game = recordedGame("ada-careful", save.commands.length - CLOSE);
    const store = createGameStore(gameAuthority(game));
    await store.getState().refresh();
    gallery.getState().clear();
    render(
      <GameProvider store={store}>
        <Results place="the hub" foot={<MomentCard over="results" />} />
        <MomentCard over="world" />
        <CardView />
      </GameProvider>,
    );
    const command = recordedCommand(save.commands[CLOSE]!.command);
    await act(async () => {
      await store.getState().send(command);
      store.getState().setReportOpen(true);
    });
    const view = store.getState().view!;
    expect(view.card?.kind).toBe("chapter");
    const key = cardKey(view.card);
    // The results line and the moment card tell the close.
    await waitFor(() => expect(document.querySelector("[data-story-line='line.chapter.closed']")).not.toBeNull());
    const card = await screen.findByRole("dialog", { name: say("moment.chapter.kicker") });
    expect(store.getState().cardClosed).toBe(key);
    fireEvent.click(card.querySelector("[data-moment-card]")!);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: say("moment.chapter.kicker") })).toBeNull());
    act(() => store.getState().setReportOpen(false));
    // The old chapter card does not follow: nothing full screen opens, and the card waits in the gallery.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector("[data-share-card]")).toBeNull();
    expect(gallery.getState().kept.some((kept) => kept.key === key)).toBe(true);
  });

  test("[R-MOMENT-006] given the same close where no moment card stands, then the chapter's share card opens", async () => {
    const save = recordedSave("ada-careful");
    const game = recordedGame("ada-careful", save.commands.length - CLOSE);
    const store = createGameStore(gameAuthority(game));
    await store.getState().refresh();
    render(
      <GameProvider store={store}>
        <CardView />
      </GameProvider>,
    );
    const command = recordedCommand(save.commands[CLOSE]!.command);
    await act(async () => {
      await store.getState().send(command);
      store.getState().setReportOpen(false);
    });
    expect(store.getState().cardClosed).toBeNull();
    expect(await screen.findByRole("dialog")).toBeDefined();
    expect(document.querySelector("[data-share-card='chapter']")).not.toBeNull();
  });
});
