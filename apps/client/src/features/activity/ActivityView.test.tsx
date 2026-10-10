import { content, text } from "@japacity/content";
import type { ActivityOption, PlayerView } from "@japacity/sim";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { requirementSentence } from "../../shared/words/requirement";
import { lowerFirst, say } from "../../shared/words/text";
import { ActivityView } from "./ActivityView";

const addButton = (id: string) => screen.getByRole("button", { name: `${text[`${id}.name`] ?? id}` });

describe("the month plan", () => {
  // The picker lists every act of the life with its card; reading each by role takes time under load.
  test("given a new life, then every free-slot activity shows its name and blurb from content", { timeout: 30_000 }, async () => {
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
      when: "now",
      done: false,
    };
    const view: PlayerView = { ...base, activities: [withParam] };
    const { store, authority } = await renderWithView(<ActivityView />, view);
    fireEvent.change(screen.getByLabelText(say("ui.activity.pick")), { target: { value: "school.ashby" } });
    expect(screen.getByRole("option", { name: text["school.ashby.name"]! })).toBeDefined();
    fireEvent.click(addButton("activity.apply-to-school"));
    // an application is an act done at once, so the param picked goes with the command
    // sent now, and the month's plan is left as it was.
    await waitFor(() => expect(authority.sent.at(-1)).toMatchObject({ type: "activity/now", activity: "activity.apply-to-school", param: "school.ashby" }));
    expect(store.getState().plan.some((pick) => pick?.activity === "activity.apply-to-school")).toBe(false);
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

  test("given a life at home, then what needs being abroad is folded into one closed group, out of the main list", async () => {
    const view = engineView();
    await renderWithView(<ActivityView />, view);
    const later = document.querySelector("details[data-later]");
    if (!(later instanceof HTMLDetailsElement)) throw new Error("There is no later group.");
    expect(later.open).toBe(false);
    expect(within(later as HTMLElement).getByText(say("ui.activity.later"))).toBeDefined();
    const abroad = view.activities.filter((option) => content.activity[option.id]?.where === "abroad");
    expect(abroad.length).toBeGreaterThan(0);
    for (const option of abroad) expect(later.contains(addButton(option.id))).toBe(true);
    expect(later.contains(addButton("activity.rest"))).toBe(false);
  });

  test("given a life abroad, then nothing is folded away", async () => {
    const base = engineView();
    await renderWithView(<ActivityView />, { ...base, place: { ...base.place, where: "abroad" } });
    expect(document.querySelector("details[data-later]")).toBeNull();
  });

  test("given a university application with no school open, then the card says what each university asks", async () => {
    const base = engineView();
    const apply: ActivityOption = { id: "activity.apply-to-school", allowed: true, missing: [], params: [], cost: [], affordable: true, when: "now", done: false };
    await renderWithView(<ActivityView />, { ...base, activities: [apply] });
    expect(screen.getByText(say("ui.activity.no-school"))).toBeDefined();
    for (const school of Object.values(content.school)) expect(screen.getByText(new RegExp(`^${text[`${school.id}.name`]!} asks for band`))).toBeDefined();
    expect(addButton("activity.apply-to-school").hasAttribute("disabled")).toBe(true);
  });

  test("given an activity that cannot be paid for, then it says how much is short", async () => {
    const base = engineView();
    const cost = { currency: "NGN" as const, amount: base.pockets.NGN.bank + base.pockets.NGN.cash + 8_050_000 };
    const sitting: ActivityOption = { id: "activity.sit-english-test", allowed: true, missing: [], params: null, cost: [cost], affordable: false, when: "now", done: false };
    await renderWithView(<ActivityView />, { ...base, activities: [sitting] });
    expect(screen.getByText(new RegExp(`^Short by ${formatMoney(8_050_000, "NGN")}:`))).toBeDefined();
  });

  test("given a route already looked into, then looking into it reads as done, not as not yet heard", async () => {
    const base = engineView();
    const lookInto: ActivityOption = {
      id: "activity.look-into-route",
      allowed: false,
      missing: [{ type: "route/state", route: "route.uk-masters", in: ["heard"] }],
      params: null,
      cost: [],
      affordable: true,
      when: "now",
      done: false,
    };
    const routes = base.routes.map((route) => (route.id === "route.uk-masters" ? { ...route, state: "known" as const } : route));
    await renderWithView(<ActivityView />, { ...base, routes, activities: [lookInto] });
    expect(screen.getByText(say("ui.req.route-state-past", { route: text["route.uk-masters.name"]!, state: lowerFirst(say("ui.route.state.known")) }))).toBeDefined();
    expect(screen.queryByText(new RegExp(say("ui.route.state.heard")))).toBeNull();
    expect(screen.getByText(say("ui.activity.done-already"))).toBeDefined();
    expect(screen.queryByText(say("ui.activity.why-not"))).toBeNull();
  });

  test("[R-WALLET-016] given a job held one month, then the card shows the view's pay, never content's written figure, and says one month", async () => {
    const base = engineView("scenario.tunde");
    const job = base.job.id ?? "activity.rest";
    const written = content.activity[job]?.pay;
    if (written === null || written === undefined || typeof written.amount !== "number") throw new Error("The job has no pay.");
    // The month as the wallet will book it differs from the written figure (after tax or a raise).
    const pay = { currency: written.currency, amount: written.amount - 123_400 };
    await renderWithView(<ActivityView />, { ...base, job: { id: job, months: 1, side: null, pay, sidePay: null } });
    expect(screen.getByText(say("ui.job.pay", { amount: formatMoney(pay.amount, pay.currency) }))).toBeDefined();
    expect(screen.queryByText(say("ui.job.pay", { amount: formatMoney(written.amount, written.currency) }))).toBeNull();
    expect(screen.getByText("1 month in")).toBeDefined();
  });
});
