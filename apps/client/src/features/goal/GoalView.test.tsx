import { content } from "@japacity/content";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView, engineView, richAbroadView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { requirementSentence } from "../../shared/words/requirement";
import { nameOf, say } from "../../shared/words/text";
import { GoalView } from "./GoalView";

// The view rule for goals is still pending in the rule list until the goal kind lands; these tests use a hand-built view.
describe("life goals", () => {
  test("given open goals, then each shows its items as met or not, in the words of its requirements", async () => {
    await renderWithView(<GoalView />, richAbroadView());
    expect(screen.getByText(nameOf("goal.own-door"))).toBeDefined();
    const doneIf = content.goal["goal.own-door"]!.doneIf;
    for (const requirement of doneIf) {
      const item = screen.getByText(requirementSentence(requirement));
      expect(item.closest("li")?.getAttribute("data-met")).toBe("true");
      expect(item.className).toContain("line-through");
    }
    const open = screen.getByText(requirementSentence(content.goal["goal.clean-file"]!.doneIf[0]!));
    expect(open.closest("li")?.getAttribute("data-met")).toBe("false");
  });

  test("given a goal done, then the done list names it with its month", async () => {
    await renderWithView(<GoalView />, richAbroadView());
    expect(screen.getByText(say("ui.goal.done-item", { goal: nameOf("goal.first-car"), month: 41 }))).toBeDefined();
  });

  test("given Ada just landed and no goal open or done (set on the view), then the panel says so", async () => {
    const view = { ...abroadView(), goals: { open: [], done: [] } };
    await renderWithView(<GoalView />, view);
    expect(screen.getByText(say("ui.goal.none"))).toBeDefined();
  });

  test("given a life at home with no goals, then the panel does not show", async () => {
    await renderWithView(<GoalView />, engineView());
    expect(screen.queryByText(say("ui.goal.title"))).toBeNull();
  });
});
