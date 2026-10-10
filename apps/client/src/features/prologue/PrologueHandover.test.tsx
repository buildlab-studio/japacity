// The page as the handover waits for the player (prologue.md R-PROLOGUE-014): the family turns over and the stamp lands, and the world opens only when Go is tapped, or the page; never on a
// timer, since ten facts are not read in three seconds.
import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { PageHandover, STAMP_AT_MS } from "./PrologueView";

afterEach(() => {
  vi.useRealTimers();
});

describe("the page as the handover", () => {
  test("[R-PROLOGUE-014] given the page after Begin, when a minute passes with no tap, then the stamp has landed and the world has not opened; Go opens it once", async () => {
    const done = vi.fn();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderWithView(<PageHandover onDone={done} />, engineView());
    act(() => {
      vi.advanceTimersByTime(STAMP_AT_MS + 60_000);
    });
    expect(document.querySelector("[data-page] [data-stamp]")).not.toBeNull();
    expect(done).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: say("ui.prologue.start") }));
    expect(done).toHaveBeenCalledTimes(1);
  });
});
