import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { payAMonth } from "./pay";

const SHOP = "activity.job-uk-retail-part" as Id<"activity">;
const TEACHER = "activity.job-teacher" as Id<"activity">;

function figure(id: Id<"activity">): { currency: string; amount: number } {
  const pay = content.activity[id]?.pay;
  if (pay === null || pay === undefined || typeof pay.amount !== "number") throw new Error(`${id} has no figure`);
  return { currency: pay.currency, amount: pay.amount };
}

describe("a job's pay a month", () => {
  test("[world:one-action-one-sheet] given the part-time shop job in the UK, whose pay content keeps a year, when its pay a month is read, then it is the year over twelve, rounded down as the simulation pays it", () => {
    const year = figure(SHOP);
    expect(content.activity[SHOP]?.where).toBe("abroad");
    expect(payAMonth(SHOP)).toEqual({ currency: year.currency, amount: Math.floor(year.amount / 12) });
    expect(payAMonth(SHOP)?.amount).toBeLessThan(year.amount);
  });

  test("[world:one-action-one-sheet] given a job at home, whose pay content keeps a month, when its pay a month is read, then it is the figure as it stands", () => {
    expect(payAMonth(TEACHER)).toEqual(figure(TEACHER));
  });

  test("[world:one-action-one-sheet] given every job abroad with a figure of its own, when its pay a month is read, then none says the year's figure", () => {
    const abroad = Object.values(content.activity).filter((entry) => (entry.slot === "main" || entry.slot === "side") && entry.where === "abroad" && entry.pay !== null && typeof entry.pay.amount === "number");
    expect(abroad.length).toBeGreaterThan(3);
    expect(abroad.map((entry) => [entry.id, payAMonth(entry.id)?.amount])).toEqual(abroad.map((entry) => [entry.id, Math.floor((entry.pay?.amount as number) / 12)]));
  });

  test("[world:one-action-one-sheet] given a sponsor's job, whose pay is a term on the route, when its pay a month is read, then there is no figure to show", () => {
    const sponsored = Object.values(content.activity).find((entry) => entry.pay !== null && typeof entry.pay.amount !== "number");
    if (sponsored === undefined) throw new Error("No sponsor's job in content");
    expect(payAMonth(sponsored.id)).toBeNull();
  });
});
