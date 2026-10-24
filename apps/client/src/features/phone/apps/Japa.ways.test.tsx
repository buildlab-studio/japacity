// The ways out in Japa (world:phone-holds-what-phones-hold; route.md): the plan's steps in content's words, a step done
// struck through and a slow one with a bar; each way looked into as a card with its window, its universities with what
// they ask and cost, its funds against what is needed and its record with the refusals in words, each assertion against
// the phone's own element.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { richView } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { nairaForFee } from "../../../shared/words/cost";
import { formatMoney } from "../../../shared/words/format";
import { checklistWords } from "../../../shared/words/requirement";
import { byMonths, nameOf, say, sayCount } from "../../../shared/words/text";
import { Japa } from "./Japa";

const UK = "route.uk-masters";

function file(): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-way-file="${UK}"]`);
  if (found === null) throw new Error("No way file for the UK master's.");
  return found;
}

describe("the ways out in Japa", () => {
  test("given a known route, then the steps use content's words, met items are crossed out and slow items show a bar, and the window shows on its card", async () => {
    const view = richView();
    await renderWithView(<Japa />, view);
    const route = view.routes[0]!;
    const steps = document.querySelector<HTMLElement>("[data-steps]")!;
    for (const item of route.checklist) {
      const label = [...steps.querySelectorAll("li span span")].find((span) => span.textContent === checklistWords(UK, item.id));
      expect(label).toBeDefined();
      expect(label?.closest("li")?.getAttribute("data-met")).toBe(item.met ? "true" : "false");
      expect(label?.className.includes("line-through")).toBe(item.met);
    }
    const partial = route.checklist.find((item) => !item.met && item.need !== null);
    expect(partial).toBeDefined();
    expect(screen.getByRole("progressbar", { name: checklistWords(UK, partial?.id ?? "") })).toBeDefined();
    expect(file().querySelector("[data-way-window]")?.textContent).toBe(say("ui.route.window.narrowing"));
  });

  test("given funds, refusals and schools, then they are shown from the view", async () => {
    await renderWithView(<Japa />, richView());
    expect(screen.getByText(say("ui.route.funds.line", { shown: formatMoney(1_200_000, "GBP"), required: formatMoney(3_000_000, "GBP") }))).toBeDefined();
    expect(screen.getByText(sayCount("ui.route.refusals", 1, { count: 1 }))).toBeDefined();
    expect(screen.queryByText(/1 times/)).toBeNull();
    expect(screen.getByText(say("ui.refusal.funds"))).toBeDefined();
    expect(screen.getByText(nameOf("school.northgate"))).toBeDefined();
    // The answer's month as months away (world:top-band-is-lively-pill): the school answers as month 13 ends.
    expect(screen.getByText(say("phone.japa.school.pending", { when: byMonths(13, richView().month) }))).toBeDefined();
    expect(document.querySelector("[data-way-file]")?.textContent).not.toMatch(/month \d+/i);
  });

  test("[route:applying-to-a-school] given a route looked into with no application yet, then every university's deposit, tuition and grade minimum show before anything is paid, and no band in English", async () => {
    const rich = richView();
    const view: PlayerView = { ...rich, routes: rich.routes.map((route) => ({ ...route, schools: [], school: null })) };
    await renderWithView(<Japa />, view);
    expect(screen.getByText(say("ui.route.schools.before"))).toBeDefined();
    for (const school of Object.values(content.school)) {
      expect(screen.getByText(say("ui.route.school.costs", { deposit: formatMoney(school.deposit, "GBP"), tuition: formatMoney(school.tuition, "GBP") }))).toBeDefined();
    }
    expect(screen.queryAllByText(/in English/)).toEqual([]);
    expect(screen.getAllByText(/or better\./).length).toBeGreaterThan(0);
    expect(screen.getByText(say("ui.route.foreign-fee"))).toBeDefined();
  });

  test("given an offer and too little naira in the bank, then the deposit says which figure is short", async () => {
    const rich = richView();
    const view: PlayerView = { ...rich, pockets: { ...rich.pockets, NGN: { bank: 100_000_000, cash: 900_000_000, locked: 0 } } };
    await renderWithView(<Japa />, view);
    const need = nairaForFee(view, "GBP", content.school["school.northgate"]!.deposit);
    expect(screen.getByText(say("ui.route.school.short", { need: formatMoney(need, "NGN"), have: formatMoney(100_000_000, "NGN"), short: formatMoney(need - 100_000_000, "NGN") }))).toBeDefined();
  });

  test("given a known route whose last funds check found nothing, then the funds come live from the checklist, never as nothing of nothing", async () => {
    const rich = richView();
    const view: PlayerView = {
      ...rich,
      routes: rich.routes.map((route) => ({ ...route, funds: { heldMonths: 0, covered: false, shown: 0, required: 0 }, support: { currency: "NGN" as const, amount: 1_800_000_000 } })),
    };
    await renderWithView(<Japa />, view);
    expect(screen.queryByText(say("ui.route.funds.line", { shown: formatMoney(0, "GBP"), required: formatMoney(0, "GBP") }))).toBeNull();
    expect(screen.getByText(say("ui.route.funds.line", { shown: formatMoney(1_200_000, "GBP"), required: formatMoney(3_000_000, "GBP") }))).toBeDefined();
    expect(screen.getByText(sayCount("ui.route.funds.held", 0, { months: 0 }))).toBeDefined();
  });

  test("given no figure needed yet, then the funds say so in words", async () => {
    const rich = richView();
    const view: PlayerView = {
      ...rich,
      routes: rich.routes.map((route) => ({
        ...route,
        checklist: route.checklist.map((item) => ({ ...item, have: item.have === null ? null : 0, need: item.need === null ? null : 0 })),
        funds: { heldMonths: 0, covered: false, shown: 0, required: 0 },
      })),
    };
    await renderWithView(<Japa />, view);
    expect(screen.getByText(say("ui.route.funds.none-needed"))).toBeDefined();
    expect(screen.queryByText(/shown of/)).toBeNull();
  });
});
