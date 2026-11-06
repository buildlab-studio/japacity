// Every sheet closes the same way (world:sheets-one-frame): the card and the paper slip each carry the one close mark at their top
// right, with a hit area of at least 44 by 44, and a tap on it says not now.
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import "../testing/render";
import { say } from "../words/text";
import { AskSheet } from "./AskSheet";
import type { Ask } from "./contract";

afterEach(() => cleanup());

function askOf(form: Ask["form"], dismiss: () => void): Ask {
  return { form, icon: "hand", who: "The clinic", title: "TB test", line: "A nurse and a form.", cost: null, button: "Take test", act: () => undefined, dismiss };
}

describe("the sheet's close", () => {
  test.each(["card", "slip"] as const)("[world:sheets-one-frame] given a %s, when it opens, then its one close mark stands at its top right at 44 px, and a tap on it closes the sheet", (form) => {
    const dismiss = vi.fn();
    render(<AskSheet ask={askOf(form, dismiss)} formatMoney={(amount) => String(amount)} />);
    const closes = document.querySelectorAll<HTMLElement>("[data-sheet-close]");
    expect(closes).toHaveLength(1);
    const close = closes[0]!;
    expect(close.getAttribute("aria-label")).toBe(say("ui.world.close"));
    expect(close.className).toMatch(/\babsolute\b/);
    expect(close.className).toMatch(/\btop-1\.5\b/);
    expect(close.className).toMatch(/\bright-1\.5\b/);
    expect(close.className).toMatch(/\bsize-11\b/);
    fireEvent.click(close);
    expect(dismiss).toHaveBeenCalled();
  });
});
