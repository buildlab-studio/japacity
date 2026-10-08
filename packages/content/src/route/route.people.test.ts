import { describe, expect, test } from "vitest";

import { content, text, withPeopleRoutes } from "../index";

const used = withPeopleRoutes(content);
const PEOPLE_ROUTES = ["route.uk-partner", "route.ca-spouse", "route.uk-dependant", "route.ca-accompany"] as const;

describe("the people routes, held out until the gate test names them", () => {
  test("[R-ENGINE-014] given the partner and dependant routes joined, when figures from people.md are read back, then each matches the page", () => {
    expect(used.route["route.uk-partner"]).toMatchObject({
      gate: "partner",
      country: "country.uk",
      status: "status.uk-partner",
      refusalBaseBp: 500,
      window: "var.uk-family-window",
      partner: { sponsorStatuses: ["status.uk-settled", "status.uk-citizen"], bandMin: 30, feeVar: "var.uk-partner-fee", surchargeYears: 3, decisionMonths: 3, livingTogetherMonths: 24, floorVar: "var.uk-partner-income" },
    });
    expect(used.route["route.ca-spouse"]).toMatchObject({
      gate: "partner",
      country: "country.canada",
      status: "status.ca-resident",
      refusalBaseBp: 600,
      window: "var.ca-family-window",
      partner: { sponsorStatuses: ["status.ca-resident", "status.ca-citizen"], bandMin: null, feeVar: "var.ca-sponsor-fee", surchargeYears: 0, decisionMonths: 12, livingTogetherMonths: null, floorVar: null },
    });
    expect(used.route["route.uk-dependant"]).toMatchObject({
      gate: "dependant",
      status: "status.uk-dependant",
      refusalBaseBp: 300,
      window: null,
      dependant: { maintenanceVar: "var.uk-dependant-maintenance", leadMonthsExempt: 12, feeVar: null, feeFromLead: true, decisionMonths: 1 },
    });
    expect(used.route["route.ca-accompany"]).toMatchObject({
      gate: "dependant",
      status: "status.ca-resident",
      refusalBaseBp: 300,
      window: null,
      dependant: { maintenanceVar: null, leadMonthsExempt: null, feeVar: "var.ca-accompany-fee", feeFromLead: false, decisionMonths: 1 },
    });
    expect(content.var["var.uk-partner-fee"]?.start).toBe(206400);
    expect(content.var["var.ca-sponsor-fee"]?.start).toBe(134500);
    expect(content.var["var.ca-accompany-fee"]?.start).toBe(160000);
    expect(content.var["var.uk-dependant-maintenance"]?.start).toBe(28500);
    expect(content.var["var.uk-partner-income"]?.start).toBe(2900000);
  });

  test("[R-ENGINE-014] given the people routes, when their checklists are read, then each comes to 100 with the page's weights and every item has words", () => {
    const weights = Object.fromEntries(PEOPLE_ROUTES.map((id) => [id, Object.fromEntries(used.route[id]!.checklist.map((item) => [item.id, item.weight]))]));
    expect(weights).toEqual({
      "route.uk-partner": { married: 20, sponsor: 20, floor: 15, english: 10, passport: 5, tb: 5, applied: 25 },
      "route.ca-spouse": { married: 25, sponsor: 25, passport: 10, applied: 40 },
      "route.uk-dependant": { joint: 30, lead: 30, passport: 10, tb: 10, funds: 10, applied: 10 },
      "route.ca-accompany": { joint: 40, lead: 40, applied: 20 },
    });
    const missing = PEOPLE_ROUTES.flatMap((id) => [`${id}.name`, `${id}.blurb`, ...used.route[id]!.checklist.map((item) => `${id}.item.${item.id}`)]).filter((key) => (text[key] ?? "") === "");
    expect(missing).toEqual([]);
  });

  test("[R-ENGINE-014] given the people routes joined, when every route, status, activity and offer they bring is read, then each has a name, and each id they name exists", () => {
    const added = [
      ...PEOPLE_ROUTES,
      ...Object.keys(used.activity).filter((id) => content.activity[id as keyof typeof content.activity] === undefined),
      ...Object.keys(used.status).filter((id) => content.status[id as keyof typeof content.status] === undefined),
      ...Object.keys(used.offer).filter((id) => content.offer[id as keyof typeof content.offer] === undefined),
    ];
    expect(added).toEqual(expect.arrayContaining(["activity.apply-uk-partner", "activity.apply-ca-spouse", "activity.apply-uk-dependant", "activity.apply-ca-accompany", "status.uk-partner", "status.uk-dependant", "offer.ca-assistance"]));
    expect(added.filter((id) => (text[`${id}.name`] ?? "") === "")).toEqual([]);
    const ids = JSON.stringify([used.route, used.activity, used.status, used.offer]).match(/"(route|status|var|activity|document|country|obligation)\.[a-z0-9-]+"/g) ?? [];
    const tables: Record<string, Record<string, unknown>> = { route: used.route, status: used.status, var: used.var, activity: used.activity, document: used.document, country: used.country, obligation: used.obligation };
    const unknown = [...new Set(ids.map((quoted) => quoted.slice(1, -1)))].filter((id) => tables[id.split(".")[0]!]?.[id] === undefined);
    expect(unknown).toEqual([]);
  });
});

describe("the undertaking, the assistance and the points with a spouse", () => {
  test("[R-ENGINE-014] given the undertaking, the assistance offer and Canada's bar, when figures from undertaking.md are read back, then each matches the page", () => {
    expect(content.obligation["obligation.undertaking-ca"]).toMatchObject({ type: "undertaking", where: "any", currency: "CAD", rateBp: 0, term: 36, grace: 2, sink: "undertaking" });
    expect(content.obligation["obligation.undertaking-ca"]?.term).toBe(content.tuning.undertaking.months);
    expect(content.obligation["obligation.undertaking-ca"]?.onDefault).toContainEqual({ type: "credit/mark", amount: -content.tuning.credit.onDefault });
    expect(content.var["var.ca-assistance"]?.start).toBe(73300);
    expect(used.offer["offer.ca-assistance"]?.terms).toEqual({ amount: 73300 });
    expect(content.tuning.undertaking).toEqual({ months: 36, assistanceUnder: 100000 });
    expect(content.country["country.canada"]?.partnerBarMonths).toBe(60);
    expect(content.country["country.uk"]?.partnerBarMonths).toBe(0);
  });

  test("[R-ENGINE-014] given the points table with a spouse, when figures from people.md are read back, then each matches the page", () => {
    const table = content.points["points.canada-spouse"]!;
    expect(table.age.map((row) => row.points)).toEqual([90, 95, 100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 35, 25, 15, 5, 0]);
    expect(table.education.map((row) => row.points)).toEqual([28, 91, 112, 126, 140]);
    expect(table.language.map((row) => row.points)).toEqual([16, 22, 29, 32]);
    expect(table.spouse).toEqual({
      education: [
        { level: 1, points: 2 },
        { level: 2, points: 7 },
        { level: 3, points: 8 },
        { level: 4, points: 10 },
      ],
      language: [
        { band: 50, points: 1 },
        { band: 60, points: 3 },
        { band: 70, points: 5 },
      ],
      canadianWork: [0, 5, 7, 8, 9, 10].map((points, years) => ({ years, points })),
      cap: 40,
    });
    expect(table.transfer).toEqual(content.points["points.canada"]!.transfer);
    expect(table.siblingBonus).toBe(15);
  });
});
