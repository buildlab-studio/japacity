// The page as the handover waits for the player (prologue.md R-PROLOGUE-014): the family turns over, no stamp lands, and the world opens only when Go is tapped, or the page; never on a
// timer, since ten facts are not read in three seconds.
import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { PageHandover, TURN_MS } from "./PrologueView";

afterEach(() => {
  vi.useRealTimers();
});

describe("the page as the handover", () => {
  test("[R-PROLOGUE-014] given the page after Begin, when a minute passes with no tap, then the family has turned, no stamp has landed and the world has not opened; Go opens it once", async () => {
    const done = vi.fn();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderWithView(<PageHandover onDone={done} />, engineView());
    act(() => {
      vi.advanceTimersByTime(TURN_MS + 60_000);
    });
    // The family has turned over and no stamp has landed: the page takes none before a visa (R-PROLOGUE-009, 014, amended).
    expect(document.querySelector("[data-family]")).not.toBeNull();
    expect(document.querySelector("[data-page] [data-stamp]")).toBeNull();
    expect(done).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: say("ui.prologue.start") }));
    expect(done).toHaveBeenCalledTimes(1);
  });
});
