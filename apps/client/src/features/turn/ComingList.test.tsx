// Coming up's rows (docs/rules/world.md R-WORLD-002, text.md R-TEXT-008): the box says how many months once, and the
// line beside it is the thing with a note of a few words, never "in 2 months" again.
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { lifeSaves } from "../../../../../packages/sim/src/goldens/lives.data";
import { recordedGame } from "../../shared/testing/fixtures";
import { comingOf } from "../../shared/words/coming";
import { inMonths, say, sayCount } from "../../shared/words/text";
import { ComingList } from "./ComingList";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

describe("Coming up", () => {
  test("[R-TEXT-008] [R-WORLD-002] given a paper on its way and a birthday ahead, when Coming up opens, then each row's box says the months once, the line beside it never repeats them, and the paper carries its few-word note", () => {
    // Tunde's recorded life at the latest point with a paper on its way (the work medical), found from the end back.
    const commands = lifeSaves["tunde-borrower"]!.commands.length;
    let view = recordedGame("tunde-borrower", commands - 1).view();
    for (let back = 2; back < commands && !comingOf(view).some((item) => item.kind === "paper"); back += 1) view = recordedGame("tunde-borrower", commands - back).view();
    const coming = comingOf(view);
    expect(coming.some((item) => item.kind === "paper")).toBe(true);
    const { container } = render(<ComingList view={view} />);
    const rows = [...container.querySelectorAll<HTMLElement>("[data-coming-row]")];
    expect(rows.map((row) => row.getAttribute("data-coming-row"))).toEqual(coming.map((item) => item.kind));
    rows.forEach((row, index) => {
      const item = coming[index]!;
      const away = item.month - view.month;
      const box = row.querySelector<HTMLElement>("[data-coming-box]")!;
      expect(box.textContent).toBe(away === 0 ? say("ui.world.coming.now") : `${String(away)}${sayCount("ui.world.coming.months", away)}`);
      const shown = [...row.querySelectorAll<HTMLElement>(":scope > span:last-child > span:not(.sr-only)")].map((span) => span.textContent).join(" ");
      expect(shown).not.toContain(inMonths(item.month, view.month));
      expect(row.querySelector(".sr-only")?.textContent).toBe(inMonths(item.month, view.month));
    });
    const paper = container.querySelector("[data-coming-row='paper'] [data-coming-note]");
    expect(paper?.textContent).toBe(say("ui.world.coming.note.paper"));
    expect((paper?.textContent ?? "").split(" ").length).toBeLessThanOrEqual(3);
    expect(container.querySelector("[data-coming-row='birthday'] [data-coming-note]")).toBeNull();
  });
});
