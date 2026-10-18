// The goals and the figure in Japa (world:phone-holds-what-phones-hold; goal.md, the view rule): each open goal as a card
// with its steps met or not, the done ones with their month, and how ready the life is as a bar that fills, never a
// number with a percent sign, each assertion against the phone's own element.
import { content } from "@japacity/content";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView, engineView, richAbroadView, richView } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { requirementSentence } from "../../../shared/words/requirement";
import { nameOf, say } from "../../../shared/words/text";
import { Japa } from "./Japa";
import { agoWords } from "./JapaWays";

// These tests build the view of goals by hand.
describe("life goals in Japa", () => {
  test("given open goals, then each shows its items as met or not, in the words of its requirements", async () => {
    await renderWithView(<Japa />, richAbroadView());
    expect(screen.getByText(nameOf("goal.own-door"))).toBeDefined();
    for (const requirement of content.goal["goal.own-door"]!.doneIf) {
      const item = screen.getByText(requirementSentence(requirement));
      expect(item.closest("li")?.getAttribute("data-met")).toBe("true");
      expect(item.className).toContain("line-through");
    }
    const open = screen.getByText(requirementSentence(content.goal["goal.clean-file"]!.doneIf[0]!));
    expect(open.closest("li")?.getAttribute("data-met")).toBe("false");
  });

  test("given a goal done, then the done list names it with its month, said as months ago (world:top-band-is-lively-pill)", async () => {
    const view = richAbroadView();
    await renderWithView(<Japa />, view);
    expect(screen.getByText(say("phone.japa.goal.done", { goal: nameOf("goal.first-car"), when: agoWords(41, view.month) }))).toBeDefined();
    expect(document.querySelector("[data-goals]")?.textContent).not.toMatch(/month \d+/i);
  });

  test("given Ada just landed and no goal open or done (set on the view), then the goals say so", async () => {
    await renderWithView(<Japa />, { ...abroadView(), goals: { open: [], done: [] } });
    expect(screen.getByText(say("ui.goal.none"))).toBeDefined();
  });

  test("given a life at home with no goals, then no goals show", async () => {
    await renderWithView(<Japa />, engineView());
    expect(screen.queryByText(say("ui.goal.title"))).toBeNull();
    expect(document.querySelector("[data-goals]")).toBeNull();
  });
});

describe("the japacity figure in Japa", () => {
  test("given no route, when the head would show the figure, then it shows nothing, never a dash pair", async () => {
    await renderWithView(<Japa />, engineView());
    expect(document.querySelector("[data-japa-percent]")).toBeNull();
    expect(document.body.textContent).not.toContain("--");
  });

  test("given a route, then the figure fills its bar under the route's name from content", async () => {
    const view = richView();
    await renderWithView(<Japa />, view);
    expect(document.querySelector("[data-japa-percent]")?.getAttribute("data-japa-percent")).toBe("64");
    expect(screen.getByRole("meter").getAttribute("aria-valuenow")).toBe("64");
    expect(document.querySelector("[data-japa-route]")?.textContent).toBe(nameOf("route.uk-masters"));
  });
});
