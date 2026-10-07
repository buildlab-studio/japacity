import { content, text } from "@japacity/content";
import type { ActivityOption, PlayerView } from "@japacity/sim";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { requirementSentence } from "../../shared/words/requirement";
import { say } from "../../shared/words/text";
import { ActivityView } from "./ActivityView";

const addButton = (id: string) => screen.getByRole("button", { name: `${say("ui.activity.add")}: ${text[`${id}.name`] ?? id}` });

describe("the month plan", () => {
  test("given a new life, then every free-slot activity shows its name and blurb from content", async () => {
    const view = engineView();
    await renderWithView(<ActivityView />, view);
    for (const option of view.activities) {
      expect(screen.getByRole("heading", { name: text[`${option.id}.name`]! })).toBeDefined();
      expect(screen.getByText(text[`${option.id}.blurb`] ?? "")).toBeDefined();
    }
  });

  test("given an activity that is not allowed, then each missing requirement is shown as a sentence and it cannot be added", async () => {
    const view = engineView();
    const locked = view.activities.find((option) => !option.allowed && option.missing.length > 0);
    if (locked === undefined) throw new Error("The fixture has no locked activity.");
    await renderWithView(<ActivityView />, view);
    for (const requirement of locked.missing) expect(screen.getAllByText(requirementSentence(requirement)).length).toBeGreaterThan(0);
    expect(addButton(locked.id).hasAttribute("disabled")).toBe(true);
  });

  test("given an activity with a cost, then the cost is shown as money", async () => {
    const view = engineView();
    const paid = view.activities.find((option) => option.cost.length > 0 && option.allowed);
    if (paid === undefined) throw new Error("The fixture has no paid activity.");
    await renderWithView(<ActivityView />, view);
    const cost = paid.cost[0]!;
    expect(screen.getAllByText(say("ui.activity.cost", { amount: formatMoney(cost.amount, cost.currency) })).length).toBeGreaterThan(0);
  });

  test("given activities added to the plan, when the plan fills, then adding stops and taking one out frees a slot", async () => {
    const view = engineView();
    const { store } = await renderWithView(<ActivityView />, view);
    for (let slot = 0; slot < view.freeSlots; slot += 1) fireEvent.click(addButton("activity.rest"));
    expect(store.getState().plan).toEqual(Array.from({ length: view.freeSlots }, () => ({ activity: "activity.rest", param: null })));
    expect(addButton("activity.rest").hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getAllByRole("button", { name: new RegExp(`^${say("ui.month.slot-remove")}`) })[0]!);
    expect(store.getState().plan[0]).toBeNull();
  });

  test("given an activity that takes a param, when one is picked, then the slot carries it", async () => {
    const base = engineView();
    const withParam: ActivityOption = {
      id: "activity.apply-to-school",
      allowed: true,
      missing: [],
      params: ["school.northgate", "school.ashby"],
      cost: [],
      affordable: true,
    };
    const view: PlayerView = { ...base, activities: [withParam] };
    const { store } = await renderWithView(<ActivityView />, view);
    fireEvent.change(screen.getByLabelText(say("ui.activity.pick")), { target: { value: "school.ashby" } });
    expect(screen.getByRole("option", { name: text["school.ashby.name"]! })).toBeDefined();
    fireEvent.click(addButton("activity.apply-to-school"));
    expect(store.getState().plan[0]).toEqual({ activity: "activity.apply-to-school", param: "school.ashby" });
  });

  test("given a job, when it is quit and confirmed, then activity/quit is sent", async () => {
    const view = engineView("scenario.tunde");
    const { authority } = await renderWithView(<ActivityView />, view);
    expect(screen.getByText(text[`${view.job.id ?? ""}.name`]!)).toBeDefined();
    expect(content.activity[view.job.id ?? "activity.rest"]?.slot).toBe("main");
    fireEvent.click(screen.getByRole("button", { name: say("ui.job.quit") }));
    fireEvent.click(screen.getByRole("button", { name: say("ui.job.quit-yes") }));
    await waitFor(() => expect(authority.sent).toEqual([{ type: "activity/quit", basedOn: view.v }]));
  });
});
