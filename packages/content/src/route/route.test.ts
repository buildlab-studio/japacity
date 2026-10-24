import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { content } from "../index";

const ROAD: Id<"route"> = "route.road";
const PITCHES: Id<"offer">[] = ["offer.road-radio", "offer.road-park", "offer.road-cousin"];

describe("route checklists", () => {
  test("[japacity:figure-is-whole-percent] given every route in content but the road, when its checklist weights are added, then they come to exactly 100", () => {
    const routes = Object.values(content.route).filter((route) => route.gate !== "road");
    expect(routes.length).toBeGreaterThan(5);
    const totals = Object.fromEntries(
      routes.map((route) => [route.id, route.checklist.reduce((sum, item) => sum + item.weight, 0)]),
    );
    expect(totals).toEqual(Object.fromEntries(routes.map((route) => [route.id, 100])));
  });

  test("[japacity:figure-is-whole-percent] given the road, when its checklist is read, then it is empty: the one exception to the 100", () => {
    const roads = Object.values(content.route).filter((route) => route.gate === "road");
    expect(roads.map((route) => route.id)).toEqual([ROAD]);
    expect(content.route[ROAD]?.checklist).toEqual([]);
  });

  test("[japacity:figure-is-whole-percent] given every route in content, when its checklist is read, then no item id appears twice", () => {
    const repeated = Object.values(content.route).filter((route) => {
      const ids = route.checklist.map((item) => item.id);
      return new Set(ids).size !== ids.length;
    });
    expect(repeated).toEqual([]);
  });
});

describe("route gates", () => {
  test("[route-gates:route-entry-gate-block] given every route but the road, when its entry is read, then it names a country and a status, and its gate's own block", () => {
    const blocks = { study: "schools", sponsor: "sponsor", points: "points", endorsement: "endorsement", contract: "contract", partner: "partner", dependant: "dependant" } as const;
    const routes = Object.values(content.route).filter((route) => route.gate !== "road");
    const missing = routes.flatMap((route) => {
      const block = route.gate === "road" ? null : blocks[route.gate];
      const hasBlock = block === null ? false : block === "schools" ? route.schools.length > 0 : route[block] !== undefined;
      return [
        ...(route.country === null ? [`${route.id} country`] : []),
        ...(route.status === null ? [`${route.id} status`] : []),
        // person.md "Entries: routes and statuses": a dependant route has no window of its own (person:dependant-gate-needs).
        ...(route.window === null && route.gate !== "dependant" ? [`${route.id} window`] : []),
        ...(hasBlock ? [] : [`${route.id} ${String(block)}`]),
      ];
    });
    expect(missing).toEqual([]);
    // person:dependant-gate-needs and person:partner-gate-needs add the dependant and partner gates.
    expect(new Set(routes.map((route) => route.gate))).toEqual(new Set(["study", "sponsor", "points", "endorsement", "contract", "partner", "dependant"]));
  });
});

describe("the road", () => {
  test("[road:road-route-has-no-figure] given route.road, when its entry is read, then it has the road gate, no window, no checklist and so no japacity figure", () => {
    const road = content.route[ROAD];
    expect(road?.gate).toBe("road");
    expect(road?.window).toBeNull();
    expect(road?.checklist).toEqual([]);
    // The figure is the checklist's earned weight; with no items there is nothing to earn and no 100 to reach.
    expect(road?.checklist.reduce((sum, item) => sum + item.weight, 0)).toBe(0);
    expect(road?.country).toBeNull();
    expect(road?.status).toBeNull();
    expect(content.tuning.road.enabled).toBe(true);
  });

  test("[road:taking-pitch-pays-deposit] given every pitch, when its kinds are added, then they come to 10000: fraud 3000, real-ish 1000, road 6000", () => {
    for (const id of PITCHES) {
      const pitch = content.offer[id];
      expect(pitch?.group).toBe("road");
      const kinds = pitch?.kinds;
      expect(kinds).toEqual({ fraud: 3000, realish: 1000, road: 6000 });
      expect((kinds?.fraud ?? 0) + (kinds?.realish ?? 0) + (kinds?.road ?? 0)).toBe(10000);
    }
    const pitches = Object.values(content.offer).filter((offer) => offer.kinds !== undefined);
    expect(pitches.map((offer) => offer.id).sort()).toEqual([...PITCHES].sort());
  });

  test("[road:taking-pitch-pays-deposit] given the road's outcome table, when each step's row is added, then it comes to 10000", () => {
    const steps = content.route[ROAD]?.road?.steps ?? [];
    expect(steps.map((step) => step.id)).toEqual(["desert", "compound", "coast", "sea"]);
    for (const step of steps) expect(step.on + step.held + step.turned + step.lost).toBe(10000);
  });

  test("[engine:content-checked-before-play] given the road's steps, when their months and rows are read, then they match road.md", () => {
    expect(content.route[ROAD]?.road?.steps).toEqual([
      { id: "desert", months: [2, 4], on: 6000, held: 1500, turned: 2450, lost: 50 },
      { id: "compound", months: [0, 6], on: 4500, held: 4000, turned: 1450, lost: 50 },
      { id: "coast", months: [1, 3], on: 5500, held: 2500, turned: 1950, lost: 50 },
      { id: "sea", months: [1, 1], on: 6000, held: 0, turned: 3850, lost: 150 },
    ]);
  });

  test("[engine:content-checked-before-play] given the road's set pieces, when their answers are read, then each keeps a way out (road:road-night-allows-turn-back)", () => {
    const night = content.setpiece["setpiece.road-night"]?.questions.flatMap((question) => question.answers.map((answer) => answer.id));
    const truth = content.setpiece["setpiece.road-truth"]?.questions.flatMap((question) => question.answers.map((answer) => answer.id));
    expect(night).toEqual(["go", "turn-back"]);
    expect(truth).toEqual(["pay", "call-home", "exit"]);
  });
});

/** A points score from the table, as route-gates:points-score-from-table reads it, for the page's worked examples. */
function score(age: number, level: number, band: number, workMonths: number): number {
  const table = content.points["points.canada"]!;
  const row = <T extends { points: number }>(rows: T[], at: (item: T) => number, value: number) =>
    rows.filter((item) => at(item) <= value).at(-1)?.points ?? 0;
  const agePoints = row(table.age, (item) => item.years, age);
  const education = table.education.find((item) => item.level === level)?.points ?? 0;
  const language = 4 * row(table.language, (item) => item.band, band);
  const { transfer } = table;
  const high = band >= transfer.highBand;
  const low = band >= (table.language[0]?.band ?? 0);
  const educationTransfer = level >= 3 && low ? (high ? transfer.educationHighBand : transfer.educationLowBand) : 0;
  const workTransfer =
    workMonths >= transfer.longMonths && low
      ? high
        ? transfer.workLongHighBand
        : transfer.workLongLowBand
      : workMonths >= 12 && low
        ? high
          ? transfer.workHighBand
          : transfer.workLowBand
        : 0;
  return agePoints + education + language + Math.min(transfer.cap, educationTransfer + workTransfer);
}

describe("spot checks against route-gates.md and road.md", () => {
  test("[engine:content-checked-before-play] given the gate routes, the vars and the documents, when figures are read back, then each matches the page", () => {
    const start = (id: `var.${string}`) => content.var[id]?.start;
    // Salary bars, fees, funds, in pence and Canadian cents.
    expect(start("var.uk-skilled-salary")).toBe(4170000);
    expect(start("var.uk-care-salary")).toBe(2500000);
    expect(start("var.uk-skilled-visa-fee")).toBe(81900);
    expect(start("var.uk-care-visa-fee")).toBe(32400);
    expect(start("var.uk-surcharge-year")).toBe(103500);
    expect(start("var.uk-skilled-maintenance")).toBe(127000);
    expect(start("var.canada-funds")).toBe(1526300);
    expect(start("var.canada-eca-fee")).toBe(32900);
    expect(start("var.canada-apply-fee")).toBe(159000);
    // route-gates:canada-return-asks-authorisation: the authorisation to return and the removal costs.
    expect(start("var.canada-arc-fee")).toBe(49250);
    expect(start("var.canada-removal-cost")).toBe(384000);
    expect(start("var.uk-talent-endorse-fee")).toBe(56100);
    expect(start("var.uk-talent-visa-fee")).toBe(20500);
    // Cut-offs and windows.
    expect(start("var.canada-cutoff")).toBe(405);
    expect(start("var.canada-care-cutoff")).toBe(370);
    expect(start("var.canada-decision-months")).toBe(6);
    expect(start("var.uk-care-window")).toBe(0);
    expect(start("var.uae-window")).toBe(2);
    // Director starts.
    expect(start("var.canada-surge")).toBe(30);
    expect(start("var.passport-fee")).toBe(10000000);
    expect(start("var.flight-factor")).toBe(10000);
    // Refusal bases.
    const base = (id: `route.${string}`) => content.route[id]?.refusalBaseBp;
    expect([base("route.uk-care"), base("route.uk-skilled"), base("route.canada-points"), base("route.uk-talent"), base("route.gulf-contract")]).toEqual([
      500, 500, 1000, 300, 1000,
    ]);
    // The endorsement draw and the contract's age limit.
    expect(content.route["route.uk-talent"]?.endorsement).toMatchObject({ baseBp: 2500, perPortfolioBp: 700, perNetworkBp: 10, capBp: 8500, cooldown: 6 });
    expect(content.route["route.gulf-contract"]?.contract?.maxAgeMonths).toBe(540);
    expect(content.route["route.gulf-contract"]?.flightPaidByEmployer).toBe(true);
    // Documents.
    expect(content.document["document.nmcn-verification"]).toMatchObject({ wait: [6, 12], validMonths: 24 });
    expect(content.document["document.eca"]).toMatchObject({ wait: [2, 4], validMonths: 60 });
    expect(content.document["document.endorsement"]).toMatchObject({ wait: [1, 2], validMonths: 3 });
    expect(content.document["document.nursing-licence"]?.validMonths).toBe(36);
    // Activity fees: ₦66,875 verification, ₦60,000 medical, ₦25,000 licence.
    expect(content.activity["activity.request-verification"]?.cost).toEqual([{ currency: "NGN", amount: 6687500, reason: "fee-document" }]);
    expect(content.activity["activity.gulf-medical"]?.cost).toEqual([{ currency: "NGN", amount: 6000000, reason: "fee-test" }]);
    expect(content.activity["activity.renew-licence"]?.cost).toEqual([{ currency: "NGN", amount: 2500000, reason: "fee-document" }]);
    // The skilled visa carries three years of surcharge, the talent visa five, the care visa none.
    const surcharges = (id: `activity.${string}`) => content.activity[id]?.cost.filter((cost) => cost.reason === "fee-surcharge").length;
    expect([surcharges("activity.apply-uk-skilled"), surcharges("activity.apply-uk-talent"), surcharges("activity.apply-uk-care")]).toEqual([3, 5, 0]);
  });

  test("[engine:content-checked-before-play] given the sponsor and agent offers, when their figures are read back, then each matches the page", () => {
    const offer = (id: `offer.${string}`) => content.offer[id]!;
    expect(offer("offer.sponsor-care-home")).toMatchObject({ chanceBp: 800, cooldown: 3, expiresAfter: 2, fraudBp: 2500 });
    expect(offer("offer.sponsor-care-home").terms).toEqual({
      salary: { from: "range", min: 2500000, max: 2900000, step: 50000 },
      fee: 450000000,
    });
    expect(offer("offer.sponsor-trust").terms).toEqual({ salary: 3130000 });
    expect(offer("offer.sponsor-tech-firm")).toMatchObject({ chanceBp: 400, cooldown: 4, fraudBp: 1500 });
    expect(offer("offer.sponsor-tech-firm").terms.salary).toEqual({ from: "range", min: 4200000, max: 6000000, step: 100000 });
    expect(offer("offer.sponsor-agency")).toMatchObject({ chanceBp: 600, cooldown: 3, expiresAfter: 1, fraudBp: 5000 });
    expect(offer("offer.sponsor-agency").terms.fee).toBe(500000000);
    // The accountancy firm: £46,000 to £56,000 by £1,000 about the chartered accountant's going rate of £49,200.
    expect(offer("offer.sponsor-accounting-firm")).toMatchObject({ chanceBp: 400, cooldown: 4, expiresAfter: 2, fraudBp: 0 });
    expect(offer("offer.sponsor-accounting-firm").terms).toEqual({ salary: { from: "range", min: 4600000, max: 5600000, step: 100000 } });
    // The Gulf agent: ₦900,000 to ₦1,800,000 by ₦100,000; AED 1,500 to 2,200 by 100, in fils.
    expect(offer("offer.gulf-agent")).toMatchObject({ chanceBp: 1000, cooldown: 4, expiresAfter: 2, fraudBp: 4000 });
    expect(offer("offer.gulf-agent").terms.fee).toEqual({ from: "range", min: 90000000, max: 180000000, step: 10000000 });
    expect(offer("offer.gulf-agent").terms.salary).toEqual({ from: "range", min: 150000, max: 220000, step: 10000 });
    expect(offer("offer.gulf-agent").signs.find((sign) => sign.key === "pay-today")).toEqual({ key: "pay-today", honestBp: 2000, fraudBp: 8500 });
    // The road's pitches.
    expect([offer("offer.road-radio").chanceBp, offer("offer.road-park").chanceBp, offer("offer.road-cousin").chanceBp]).toEqual([300, 500, 200]);
    expect(offer("offer.road-radio").terms.deposit).toEqual({ from: "range", min: 40000000, max: 80000000, step: 10000000 });
    expect(offer("offer.road-cousin").terms.deposit).toMatchObject({ min: 30000000, max: 60000000 });
    expect(offer("offer.road-ransom-call").terms.sum).toMatchObject({ min: 50000000, max: 200000000 });
    expect(offer("offer.road-park").pressure).toEqual({ refusalBp: 200, defaultBp: 300, lowStandingBp: 200, perYearOver30Bp: 100, strongRouteBp: 400 });
  });

  test("[engine:content-checked-before-play] given the points table, when the page's worked examples are scored from it, then the developer has 404 and the graduate 335", () => {
    const table = content.points["points.canada"]!;
    expect(table.age.find((row) => row.years === 20)?.points).toBe(110);
    expect(table.age.find((row) => row.years === 35)?.points).toBe(77);
    expect(table.age.at(-1)).toEqual({ years: 45, points: 0 });
    expect(table.education.find((row) => row.level === 3)?.points).toBe(120);
    expect(table.education.find((row) => row.level === 5)?.points).toBe(150);
    expect(table.language).toEqual([
      { band: 60, points: 17 },
      { band: 65, points: 23 },
      { band: 70, points: 31 },
      { band: 80, points: 34 },
    ]);
    // The developer at 25, a bachelor's, band 7.0, 18 months in a job.
    expect(score(25, 3, 70, 18)).toBe(404);
    // The graduate at 23, a bachelor's, band 6.5, no job yet.
    expect(score(23, 3, 65, 0)).toBe(335);
    // Three years of work and band 7.0 at 28: the transferability cap is not reached.
    expect(score(28, 3, 70, 36)).toBe(110 + 120 + 124 + 25 + 50);
  });
});
