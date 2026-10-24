// The simulated players' boarding and pounds (scenario:economy-meets-its-targets): no style flies the master's to a first tuition
// charge it can see it cannot pay, and a player buying pounds ahead buys up to the whole funds line of the way it plans.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { mulDiv } from "../engine/int";
import type { Content, PlayerView } from "../engine/types";
import { NORTHGATE } from "../testing/ids";
import { readyLife } from "../testing/route.journey";
import { firstInstalment, poundTarget, strategies } from "./players";

const UK = "route.uk-masters";

/** The ready graduate at home with the master's granted at Northgate, holding only the pounds given, with no pledge unless one is given. */
function granted(pence: number, pledge: number | null = null): PlayerView {
  const view = readyLife(content).view();
  const routes = view.routes.map((item) =>
    item.id === UK
      ? { ...item, state: "granted" as const, school: NORTHGATE, schools: [{ ...(item.schools[0] ?? {}), id: NORTHGATE, state: "offer" as const, discount: 0 }], loanPaid: 0, support: pledge === null ? null : { currency: "GBP" as const, amount: pledge } }
      : item,
  );
  const empty = { cash: 0, bank: 0, locked: 0 };
  const pockets = { ...view.pockets, NGN: { ...view.pockets.NGN, ...empty }, USD: { ...view.pockets.USD, ...empty }, GBP: { ...view.pockets.GBP, ...empty, bank: pence } };
  return { ...view, place: { ...view.place, where: "home" }, routes, pockets } as PlayerView;
}

function departs(view: PlayerView, used: Content = content): boolean {
  return strategies.risky(view, used).some((command) => command.type === "route/depart");
}

describe("boarding with the first instalment covered", () => {
  test("[scenario:economy-meets-its-targets] [abroad-money:tuition-paid-in-instalments] given the master's granted, when the first instalment is read, then it is the schedule's first share of the tuition left after the deposit", () => {
    const school = content.school[NORTHGATE]!;
    const share = content.obligation["obligation.tuition"]!.schedule![0]!;
    expect(firstInstalment(granted(0), content, UK)).toBe(mulDiv(school.tuition - school.deposit, share, 10000));
  });

  test("[scenario:economy-meets-its-targets] given a risky player granted the master's, when the pounds held and the pledge left meet the first instalment or fall a penny short, then it boards only when they meet it", () => {
    const due = firstInstalment(granted(0), content, UK)!;
    expect(departs(granted(due))).toBe(true);
    expect(departs(granted(due - 1))).toBe(false);
    expect(departs(granted(due - 1000, 1000))).toBe(true);
    expect(departs(granted(due - 1001, 1000))).toBe(false);
  });
});

describe("pounds bought up to the funds line", () => {
  test("[scenario:economy-meets-its-targets] given the master's planned with its funds line shown, when the target is read, then it is the whole line; with no line shown, the fixed target", () => {
    const view = readyLife(content).view();
    const planned = { ...view, plan: { ...view.plan, route: UK } } as PlayerView;
    const line = (required: number): PlayerView => ({ ...planned, routes: planned.routes.map((item) => (item.id === UK ? { ...item, funds: { ...item.funds, required } } : item)) });
    expect(poundTarget(line(2_182_700), content)).toBe(2_182_700);
    expect(poundTarget(line(0), content)).toBe(600_000);
  });

  test("[scenario:economy-meets-its-targets] given Canada planned, when the target is read, then it is Canada's funds in pounds at the day's rates", () => {
    const view = readyLife(content).view();
    const planned = { ...view, plan: { ...view.plan, route: "route.canada-points" } } as PlayerView;
    const funds = content.var["var.canada-funds"]!.start;
    expect(poundTarget(planned, content)).toBe(mulDiv(funds, view.rates.CAD.official, view.rates.GBP.official));
  });
});
