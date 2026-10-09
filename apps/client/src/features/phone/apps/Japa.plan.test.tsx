// Japa names the plan (docs/rules/chapter.md R-CHAPTER-009, world.md R-WORLD-019): the way out the chapters
// follow, with its file beneath; the other ways heard of, each opening its page with the switch; and the
// plan's marks in Coming up.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { readyLife, slot, toKnown } from "../../../../../../packages/sim/src/route/route.journey";
import type { Game } from "../../../../../../packages/sim/src/testing/play";
import { GameProvider } from "../../../authority/GameProvider";
import { createGameStore } from "../../../authority/store";
import { gameAuthority, newGame } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { inMonths, nameOf, say } from "../../../shared/words/text";
import { phoneWords } from "../phone.words";
import { chapterAhead, Japa, planMarks } from "./Japa";

const UK: Id<"route"> = "route.uk-masters";
const CARE: Id<"route"> = "route.uk-care";
const LOOK = "activity.look-into-route";

function nurseOnCare(): Game {
  const game = newGame("scenario.ngozi");
  for (let month = 0; month < 8 && game.state.route[CARE]?.state === "unknown"; month += 1) game.endTurn();
  game.endTurn([slot(LOOK, CARE)]);
  return game;
}

describe("the plan in Japa's head", () => {
  test("[R-CHAPTER-009] [R-WORLD-019] given the nurse who heard of care and the master's, when she has read the care page, then Japa's head says her plan is care work with the care file beneath", async () => {
    const game = nurseOnCare();
    await renderWithView(<Japa />, game.view());
    const head = document.querySelector<HTMLElement>("[data-japa-head]");
    expect(head?.querySelector("[data-japa-plan]")?.textContent).toBe(phoneWords("phone.japa.plan", { route: nameOf(CARE) }));
    expect(head?.querySelector("[data-japa-route]")?.textContent).toBe(nameOf(CARE));
    expect(head?.querySelector("[data-japa-file]")?.textContent).toBe("The care file");
  });

  test("[R-CHAPTER-009] [R-WORLD-019] given a life that has heard of no way out, when Japa shows, then its head says there is no plan yet and names no file", async () => {
    const view = newGame("scenario.ada").view();
    expect(view.plan.route).toBeNull();
    await renderWithView(<Japa />, view);
    expect(document.querySelector("[data-japa-head]")?.textContent).toContain("No plan yet. Hear of a way out first.");
    expect(document.querySelector("[data-japa-file]")).toBeNull();
    expect(document.querySelector("[data-japa-others]")).toBeNull();
  });
});

describe("the other ways in Japa", () => {
  test("[R-CHAPTER-009] given the nurse on care, when Japa shows, then the master's is listed among the other ways heard of, and a tap opens its page with the switch; Keep mine comes back", async () => {
    const game = nurseOnCare();
    await renderWithView(<Japa />, game.view());
    const rows = [...document.querySelectorAll<HTMLElement>("[data-japa-others] [data-other-way]")];
    const ways = game.view().plan.ways.filter((way) => way.route !== CARE).map((way) => way.route);
    expect(ways).toContain(UK);
    expect(rows.map((row) => row.getAttribute("data-other-way"))).toEqual(ways);
    fireEvent.click(document.querySelector<HTMLElement>(`[data-other-way="${UK}"]`)!);
    expect(document.querySelector("[data-route-page]")?.getAttribute("data-route-page")).toBe(UK);
    expect(document.querySelector("[data-plan-switch]")).not.toBeNull();
    fireEvent.click(document.querySelector<HTMLElement>("[data-plan-keep]")!);
    expect(document.querySelector("[data-route-page]")).toBeNull();
    expect(document.querySelector("[data-japa-head]")).not.toBeNull();
  });

  test("[R-CHAPTER-009] given the nurse on care, when she makes the master's the plan from its page, then Japa's head names the master's and its file, and the file after care's is the master's decision day", async () => {
    const game = nurseOnCare();
    const store = createGameStore(gameAuthority(game));
    await store.getState().refresh();
    render(
      <GameProvider store={store}>
        <Japa />
      </GameProvider>,
    );
    fireEvent.click(document.querySelector<HTMLElement>(`[data-other-way="${UK}"]`)!);
    await act(async () => {
      fireEvent.click(document.querySelector<HTMLElement>("[data-plan-make]")!);
      // The command's reply, then the page planned after it.
      await new Promise((settle) => setTimeout(settle, 0));
    });
    fireEvent.click(document.querySelector<HTMLElement>("[data-route-back]")!);
    expect(document.querySelector("[data-japa-route]")?.textContent).toBe(nameOf(UK));
    expect(document.querySelector("[data-japa-file]")?.textContent).toBe("The master's file");
    // Care work is now another way, and the master's is not.
    const others = [...document.querySelectorAll("[data-other-way]")].map((row) => row.getAttribute("data-other-way"));
    expect(others).toContain(CARE);
    expect(others).not.toContain(UK);
    const items = content.chapter["chapter.build-the-file-care"]!.items.map((item) => ({ id: item.id, met: true }));
    const lean = store.getState().view?.plan.route ?? null;
    expect(lean).toBe(UK);
    expect(chapterAhead({ current: "chapter.build-the-file-care", items, done: [] }, lean)?.id).toBe("chapter.decision-day");
    expect(chapterAhead({ current: "chapter.build-the-file-care", items, done: [] }, CARE)?.id).toBe("chapter.decision-day-care");
  });
});

describe("the official page follows the plan", () => {
  test("[R-CHAPTER-009] [R-ADVICE-002] given the nurse who made the master's the plan while it is only heard of, when Japa shows, then the master's page is the plan's own card, planned, never under another way's heading", async () => {
    const game = nurseOnCare();
    game.accept({ type: "chapter/lean", route: UK });
    const { store } = await renderWithView(<Japa />, game.view());
    act(() => {
      store.getState().addToPlan({ activity: LOOK, param: UK });
    });
    const card = document.querySelector("[data-official-page]");
    expect(card?.getAttribute("data-official-page")).toBe(UK);
    expect(card?.getAttribute("data-official-other")).toBeNull();
    expect(card?.hasAttribute("disabled")).toBe(true);
  });
});

describe("the plan's marks", () => {
  test("[R-CHAPTER-009] [R-WORLD-002] given the master's the plan with a school's answer due, when the marks are read, then the answer is one with its month, and Japa's Coming up says it as months away", async () => {
    // Ada with her papers in hand, so the application goes in the month after she reads the page.
    const game = readyLife(content);
    toKnown(game);
    game.endTurn([slot("activity.apply-to-school", "school.northgate")]);
    const view = game.view();
    expect(view.plan.route).toBe(UK);
    const pending = view.routes.find((route) => route.id === UK)?.schools.find((school) => school.state === "pending");
    if (pending === undefined) throw new Error("No school's answer is due.");
    const marks = planMarks(view);
    expect(marks).toEqual([{ key: "route.plan.mark.school", what: say("route.plan.mark.school", { school: nameOf(pending.id) }), month: pending.readyMonth }]);
    await renderWithView(<Japa />, view);
    expect(document.querySelector("[data-reminders]")?.textContent).toContain(phoneWords("phone.japa.mark", { what: marks[0]!.what, when: inMonths(pending.readyMonth, view.month) }));
  });

  test("[R-CHAPTER-009] given the nurse on care with nothing waiting on a date, when the marks are read, then there are none", () => {
    expect(planMarks(nurseOnCare().view())).toEqual([]);
  });
});
