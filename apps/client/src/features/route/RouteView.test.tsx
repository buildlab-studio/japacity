import { content, text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { nairaForFee } from "../../shared/words/cost";
import { formatBand, formatMoney } from "../../shared/words/format";
import { say, sayCount } from "../../shared/words/text";
import { RouteView } from "./RouteView";

describe("ways out", () => {
  test("given no route heard of, then it says so and shows no route", async () => {
    await renderWithView(<RouteView />, engineView());
    expect(screen.getByText(say("ui.route.none"))).toBeDefined();
    expect(screen.queryByText(text["route.uk-masters.name"]!)).toBeNull();
  });

  test("given a known route, then the checklist uses content's words, met items are crossed out and slow items show a bar", async () => {
    const view = richView();
    await renderWithView(<RouteView />, view);
    const route = view.routes[0]!;
    for (const item of route.checklist) {
      const label = screen.getByText(text[`route.uk-masters.item.${item.id}`]!);
      expect(label.closest("li")?.getAttribute("data-met")).toBe(item.met ? "true" : "false");
      expect(label.className.includes("line-through")).toBe(item.met);
    }
    const partial = route.checklist.find((item) => !item.met && item.need !== null);
    expect(partial).toBeDefined();
    expect(screen.getByRole("progressbar", { name: text[`route.uk-masters.item.${partial?.id ?? ""}`]! })).toBeDefined();
    expect(screen.getByText(say("ui.route.window.narrowing"))).toBeDefined();
  });

  test("given funds, refusals and schools, then they are shown from the view", async () => {
    await renderWithView(<RouteView />, richView());
    expect(screen.getByText(say("ui.route.funds.line", { shown: formatMoney(1_200_000, "GBP"), required: formatMoney(3_000_000, "GBP") }))).toBeDefined();
    expect(screen.getByText(sayCount("ui.route.refusals", 1, { count: 1 }))).toBeDefined();
    expect(screen.queryByText(/1 times/)).toBeNull();
    expect(screen.getByText(say("ui.refusal.funds"))).toBeDefined();
    expect(screen.getByText(text["school.northgate.name"]!)).toBeDefined();
    expect(screen.getByText(say("ui.route.school.pending", { month: 13 }))).toBeDefined();
  });

  test("given a school offer and no deposit, when the deposit is paid, then route/pay-deposit names the school", async () => {
    const view = richView();
    const { authority } = await renderWithView(<RouteView />, view);
    fireEvent.click(screen.getByRole("button", { name: say("ui.route.pay-deposit") }));
    await waitFor(() =>
      expect(authority.sent).toEqual([{ type: "route/pay-deposit", route: "route.uk-masters", school: "school.northgate", basedOn: view.v }]),
    );
  });

  test("given a granted visa, when the plane is boarded, then route/depart is sent", async () => {
    const rich = richView();
    const view: PlayerView = { ...rich, routes: rich.routes.map((route) => ({ ...route, state: "granted" })) };
    const { authority } = await renderWithView(<RouteView />, view);
    fireEvent.click(screen.getByRole("button", { name: say("ui.route.depart") }));
    await waitFor(() => expect(authority.sent).toEqual([{ type: "route/depart", route: "route.uk-masters", basedOn: view.v }]));
  });

  test("given a route looked into with no application yet, then every university's deposit, tuition and minimums show before anything is paid", async () => {
    const rich = richView();
    const view: PlayerView = { ...rich, routes: rich.routes.map((route) => ({ ...route, schools: [], school: null })) };
    await renderWithView(<RouteView />, view);
    expect(screen.getByText(say("ui.route.schools.before"))).toBeDefined();
    for (const school of Object.values(content.school)) {
      expect(screen.getByText(say("ui.route.school.costs", { deposit: formatMoney(school.deposit, "GBP"), tuition: formatMoney(school.tuition, "GBP") }))).toBeDefined();
      expect(screen.getAllByText(new RegExp(`band ${formatBand(school.minBand).replace(".", "\\.")} in English`)).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(say("ui.route.foreign-fee"))).toBeDefined();
  });

  test("given an offer and too little naira in the bank, then the deposit says which figure is short", async () => {
    const rich = richView();
    const view: PlayerView = { ...rich, pockets: { ...rich.pockets, NGN: { bank: 100_000_000, cash: 900_000_000, locked: 0 } } };
    await renderWithView(<RouteView />, view);
    const need = nairaForFee(view, "GBP", content.school["school.northgate"]!.deposit);
    expect(
      screen.getByText(
        say("ui.route.school.short", { need: formatMoney(need, "NGN"), have: formatMoney(100_000_000, "NGN"), short: formatMoney(need - 100_000_000, "NGN") }),
      ),
    ).toBeDefined();
  });

  test("given a known route whose last funds check found nothing, then the funds come live from the checklist, never as nothing of nothing", async () => {
    const rich = richView();
    const view: PlayerView = {
      ...rich,
      routes: rich.routes.map((route) => ({ ...route, funds: { heldMonths: 0, covered: false, shown: 0, required: 0 }, support: { currency: "NGN" as const, amount: 1_800_000_000 } })),
    };
    await renderWithView(<RouteView />, view);
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
    await renderWithView(<RouteView />, view);
    expect(screen.getByText(say("ui.route.funds.none-needed"))).toBeDefined();
    expect(screen.queryByText(/shown of/)).toBeNull();
  });

  test("given a percent, then its sign is set in the body face", async () => {
    await renderWithView(<RouteView />, richView());
    expect(screen.getByText("%").className).toContain("font-sans");
  });
});
