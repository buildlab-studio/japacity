import { text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { say } from "../../shared/words/text";
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
    expect(screen.getByText(say("ui.route.refusals", { count: 1 }))).toBeDefined();
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
});
