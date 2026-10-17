// Japa carries the chapter's own checklist when the chapter is a way out's variant (docs/rules/chapter.md
// R-CHAPTER-009, world.md R-WORLD-019): the care file's items in its words, ticked as the chapter ticks them.
import { content, text } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import type { Game } from "../../../../../../packages/sim/src/testing/play";
import { newGame } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { chapterAhead, Japa } from "./Japa";

const CARE: Id<"route"> = "route.uk-care";
const UK: Id<"route"> = "route.uk-masters";
const LOOK: Id<"activity"> = "activity.look-into-route";

/** Months pass until the route is heard of, then its page is read. */
function lookInto(game: Game, route: Id<"route">): void {
  for (let month = 0; month < 8 && game.state.route[route]?.state === "unknown"; month += 1) game.endTurn();
  game.endTurn([{ activity: LOOK, param: route }]);
}

function stepsShown(): { words: string; met: string | null }[] {
  return [...document.querySelectorAll("[data-chapter-steps] li")].map((item) => ({ words: item.textContent, met: item.getAttribute("data-met") }));
}

describe("the chapter's checklist in Japa", () => {
  test("[R-CHAPTER-009] [R-WORLD-019] given a nurse on the care file, when Japa shows, then the file's items stand under the chapter's name in their own words, the months on the ward ticked", async () => {
    const game = newGame("scenario.ngozi");
    lookInto(game, CARE);
    const view = game.view();
    expect(view.chapter.current).toBe("chapter.build-the-file-care");
    await renderWithView(<Japa />, view);
    expect(document.querySelector("[data-chapter-steps]")?.getAttribute("data-chapter-steps")).toBe("chapter.build-the-file-care");
    expect(stepsShown()).toEqual([
      { words: "Twenty-four months on the ward", met: "true" },
      { words: "The council's verification: apply once the months are in", met: "false" },
      { words: "A sponsor with a licence", met: "false" },
      { words: text["chapter.build-the-file-care.item.applied"]!, met: "false" },
    ]);
  });

  test("[R-CHAPTER-009] [R-WORLD-019] given a graduate on the master's file, when Japa shows, then the route's steps stand alone", async () => {
    const game = newGame("scenario.tunde");
    lookInto(game, UK);
    expect(game.view().chapter.current).toBe("chapter.build-the-file");
    await renderWithView(<Japa />, game.view());
    expect(document.querySelector("[data-chapter-steps]")).toBeNull();
    expect(document.querySelector("[data-steps]")).not.toBeNull();
  });
});

describe("the chapter ahead", () => {
  // R-CHAPTER-010: which chapter follows is the engine's answer (chapter.plan.test.ts); Japa reads the view's.
  test("[R-CHAPTER-010] given the care file closing at the month's end, when the chapter ahead is read, then it is the chapter the view names next, its steps not yet marked", () => {
    const items = content.chapter["chapter.build-the-file-care"]!.items.map((item) => ({ id: item.id, met: true }));
    const ahead = chapterAhead({ current: "chapter.build-the-file-care", items, done: ["chapter.find-your-feet"], closes: true, next: "chapter.decision-day-care" });
    expect(ahead).toEqual({ id: "chapter.decision-day-care", now: false, items: [{ id: "tb", met: false }, { id: "police", met: false }, { id: "applied", met: false }, { id: "granted", met: false }] });
  });

  test("[R-CHAPTER-010] given decision day closing on the grant with the held funds unmet, when the chapter ahead is read, then it is the send-off; while it does not close, it is decision day with its steps as marked", () => {
    const items = content.chapter["chapter.decision-day"]!.items.map((item) => ({ id: item.id, met: item.id !== "held" }));
    expect(chapterAhead({ current: "chapter.decision-day", items, done: [], closes: true, next: "chapter.send-off" })?.id).toBe("chapter.send-off");
    expect(chapterAhead({ current: "chapter.decision-day", items, done: [], closes: false, next: "chapter.send-off" })).toEqual({ id: "chapter.decision-day", now: true, items });
  });

  test("[R-CHAPTER-010] given the last chapter closing, when the chapter ahead is read, then there is none", () => {
    expect(chapterAhead({ current: "chapter.secure", items: [{ id: "secure", met: true }], done: [], closes: true, next: null })).toBeNull();
  });
});
