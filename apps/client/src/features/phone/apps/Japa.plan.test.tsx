// Japa names the plan (chapter:chapters-follow-lean-route, world:phone-holds-what-phones-hold): the way out the chapters
// follow, with its file beneath; the other ways heard of, each opening its page with the switch; and the
// plan's marks in Coming up.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import type { Game } from "@japacity/sim/testing";
import { readyLife, slot, toKnown } from "@japacity/sim/testing";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../../authority/GameProvider";
import { createGameStore } from "../../../authority/store";
import { gameAuthority, newGame } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { inMonths, nameOf, say } from "../../../shared/words/text";
import { chapterAhead, Japa } from "./Japa";
import { planMarks } from "../../../shared/words/plan";

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
  test("[chapter:chapters-follow-lean-route] [world:phone-holds-what-phones-hold] given the nurse who heard of care and the master's, when she has read the care page, then Japa's head says her plan is health care with the care file beneath", async () => {
    const game = nurseOnCare();
    await renderWithView(<Japa />, game.view());
    const head = document.querySelector<HTMLElement>("[data-japa-head]");
    expect(head?.querySelector("[data-japa-plan]")?.textContent).toBe(say("phone.japa.plan", { route: nameOf(CARE) }));
    expect(head?.querySelector("[data-japa-route]")?.textContent).toBe(nameOf(CARE));
    expect(head?.querySelector("[data-japa-file]")?.textContent).toBe("The health care file");
  });

  test("[chapter:chapters-follow-lean-route] [world:phone-holds-what-phones-hold] given a life that has heard of no way out, when Japa shows, then its head says there is no plan yet and names no file", async () => {
    const view = newGame("scenario.ada").view();
    expect(view.plan.route).toBeNull();
    await renderWithView(<Japa />, view);
    expect(document.querySelector("[data-japa-head]")?.textContent).toContain("No plan yet");
    expect(document.querySelector("[data-japa-file]")).toBeNull();
    expect(document.querySelector("[data-japa-others]")).toBeNull();
  });
});

describe("the other ways in Japa", () => {
  test("[chapter:chapters-follow-lean-route] given the nurse on care, when Japa shows, then the master's is listed among the other ways heard of, and a tap opens its page with the switch; Keep mine comes back", async () => {
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

  test("[chapter:chapters-follow-lean-route] given the nurse on care, when she makes the master's the plan from its page, then Japa's head names the master's and its file, and the file after care's is the master's decision day", async () => {
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
    // Health care is now another way, and the master's is not.
    const others = [...document.querySelectorAll("[data-other-way]")].map((row) => row.getAttribute("data-other-way"));
    expect(others).toContain(CARE);
    expect(others).not.toContain(UK);
    const items = content.chapter["chapter.build-the-file-care"]!.items.map((item) => ({ id: item.id, met: true }));
    const view = store.getState().view;
    expect(view?.plan.route).toBe(UK);
    // chapter:view-says-closes-and-next: the chapter that follows is the view's, read with the lean as it stands.
    const chapter = view?.chapter;
    if (chapter === undefined) throw new Error("No view");
    expect(chapter.next).toBe("chapter.decision-day");
    expect(chapterAhead({ ...chapter, items, closes: true })?.id).toBe("chapter.decision-day");
  });
});

describe("the official page follows the plan", () => {
  test("[chapter:chapters-follow-lean-route] [advice:official-page-shows-checklist] given the nurse who made the master's the plan while it is only heard of, when Japa shows, then the master's page is the plan's own card, read at once when tapped, never under another way's heading", async () => {
    const game = nurseOnCare();
    game.accept({ type: "chapter/lean", route: UK });
    const { authority } = await renderWithView(<Japa />, game.view());
    const card = document.querySelector<HTMLElement>("[data-official-page]");
    expect(card?.getAttribute("data-official-page")).toBe(UK);
    expect(card?.getAttribute("data-official-other")).toBeNull();
    // activity:now-acts-and-month-acts: the page is read now, never planned for the month.
    await act(async () => {
      card?.click();
      await new Promise((settle) => setTimeout(settle, 0));
    });
    expect(authority.sent.at(-1)).toMatchObject({ type: "activity/now", activity: LOOK, param: UK });
  });
});

describe("the plan's marks", () => {
  test("[chapter:chapters-follow-lean-route] [world:top-band-is-lively-pill] given the master's the plan with a school's answer due, when the marks are read, then the answer is one with its month, and Japa's Coming up says it as months away", async () => {
    // Ada with her papers in hand, so the application goes in the month after she reads the page.
    const game = readyLife(content);
    toKnown(game);
    // The application goes in at once (activity:now-acts-and-month-acts) and the school's answer is due with the month, so the marks are read before it ends.
    game.accept({ type: "activity/now", activity: "activity.apply-to-school", param: "school.northgate" });
    const view = game.view();
    expect(view.plan.route).toBe(UK);
    const pending = view.routes.find((route) => route.id === UK)?.schools.find((school) => school.state === "pending");
    if (pending === undefined) throw new Error("No school's answer is due.");
    const marks = planMarks(view);
    expect(marks).toEqual([{ key: "route.plan.mark.school", what: say("route.plan.mark.school", { school: nameOf(pending.id) }), month: pending.readyMonth }]);
    await renderWithView(<Japa />, view);
    const reminder = document.querySelector("[data-reminders] [data-reminder='plan']");
    expect(reminder?.textContent).toBe(`${marks[0]!.what}${inMonths(pending.readyMonth, view.month)}`);
  });

  test("[chapter:chapters-follow-lean-route] given the nurse on care with nothing waiting on a date, when the marks are read, then there are none", () => {
    expect(planMarks(nurseOnCare().view())).toEqual([]);
  });
});
