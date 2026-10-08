import type { Id, StatusEntry } from "@japacity/sim";
import { StatusEntrySchema } from "@japacity/sim/schemas";
import { describe, expect, test } from "vitest";

import { content } from "../index";

const statuses = Object.values(content.status);

/** The statuses one status can lead to, by the field that names each. */
function linksOf(status: StatusEntry): [string, Id<"status">][] {
  const links: [string, Id<"status"> | null][] = [
    ["next", status.next],
    ["settled", status.settled],
    ["citizen", status.citizen],
    ["overstayer", content.country[status.country]?.overstayer ?? null],
  ];
  return links.filter((link): link is [string, Id<"status">] => link[1] !== null);
}

/** The first loop found by following next, settled and citizen from a status, or null. */
function loopFrom(table: Record<Id<"status">, StatusEntry>, start: Id<"status">): Id<"status">[] | null {
  const path: Id<"status">[] = [];
  function walk(id: Id<"status">): Id<"status">[] | null {
    if (path.includes(id)) return [...path, id];
    const entry = table[id];
    if (entry === undefined) return null;
    path.push(id);
    for (const next of [entry.next, entry.settled, entry.citizen]) {
      if (next === null) continue;
      const loop = walk(next);
      if (loop !== null) return loop;
    }
    path.pop();
    return null;
  }
  return walk(start);
}

describe("statuses", () => {
  test("[R-ENGINE-014] given every status, when it is checked against its schema, then it parses and its key is its id", () => {
    // status.md's thirteen, and people.md's partner and dependant visas (R-PEOPLE-024, 028).
    expect(statuses).toHaveLength(15);
    for (const [key, status] of Object.entries(content.status)) {
      expect(StatusEntrySchema.safeParse(status).error?.issues ?? []).toEqual([]);
      expect(status.id).toBe(key);
    }
  });

  test("[R-ENGINE-014] given every status, when its country and the statuses it leads to are looked up, then each exists and stays in the same country", () => {
    const problems = statuses.flatMap((status) => {
      if (content.country[status.country] === undefined) return [`${status.id} names ${status.country}, which does not exist`];
      return linksOf(status).flatMap(([field, id]) => {
        const target = content.status[id];
        if (target === undefined) return [`${status.id} ${field} names ${id}, which does not exist`];
        return target.country === status.country ? [] : [`${status.id} ${field} leads to ${id} in ${target.country}`];
      });
    });
    expect(problems).toEqual([]);
  });

  test("[R-ENGINE-014] given every status, when next, settled and citizen are followed, then the chain ends and never comes back", () => {
    const loops = statuses.map((status) => loopFrom(content.status, status.id)).filter((loop) => loop !== null);
    expect(loops).toEqual([]);
  });

  test("[R-ENGINE-014] given a copy of the statuses where citizenship leads back to settlement, when the chain is followed, then the loop is found", () => {
    const citizen = content.status["status.uk-citizen"]!;
    const looped = { ...content.status, "status.uk-citizen": { ...citizen, next: "status.uk-settled" as const } };
    expect(loopFrom(looped, "status.uk-settled")).toEqual(["status.uk-settled", "status.uk-citizen", "status.uk-settled"]);
  });

  test("[R-ENGINE-014] given every status, when the variables it reads are looked up, then each exists", () => {
    // people.md R-PEOPLE-024: `lead` is the lead's months left, not a variable.
    const vars = statuses.flatMap((status) =>
      [status.renewFeeVar, status.surchargeYearVar, status.settleMonthsVar, status.settleFeeVar, status.citizenFeeVar, typeof status.months === "string" && status.months !== "lead" ? status.months : null].filter(
        (id): id is Id<"var"> => id !== null,
      ),
    );
    expect(vars.length).toBeGreaterThan(5);
    expect(vars.filter((id) => content.var[id] === undefined)).toEqual([]);
  });

  test("[R-ENGINE-014] given every status that counts to settlement, when its settlement step is read, then it names the months, the fee and the status it leads to", () => {
    const counting = statuses.filter((status) => status.countsToSettlement);
    // people.md "Entries: routes and statuses": the partner and dependant visas count to settlement too (R-PEOPLE-028).
    expect(counting.map((status) => status.id)).toEqual(["status.uk-sponsored", "status.uk-talent", "status.ca-resident", "status.uk-partner", "status.uk-dependant"]);
    for (const status of counting) {
      expect(status.settleMonthsVar).not.toBeNull();
      expect(status.settleFeeVar).not.toBeNull();
      expect(status.settled).not.toBeNull();
    }
  });

  test("[R-ENGINE-014] given the statuses, when figures from status.md are read back, then each matches the page", () => {
    const sponsored = content.status["status.uk-sponsored"];
    // 36 months, one employer, a 60-day clock, renewed for 24 months.
    expect(sponsored).toMatchObject({ months: 36, work: "one-employer", clockMonths: 2, renewMonths: 24, settled: "status.uk-settled" });
    expect(content.status["status.uk-student"]).toMatchObject({ months: 16, work: "part", next: "status.uk-graduate" });
    expect(content.status["status.uk-graduate"]?.months).toBe("var.uk-graduate-months");
    expect(content.status["status.uk-settled"]).toMatchObject({ months: null, citizenAfter: 12, citizen: "status.uk-citizen" });
    // The Gulf worker: 24 months, lapses at once, the employer holds the passport.
    expect(content.status["status.gulf-worker"]).toMatchObject({ months: 24, lapsesAtOnce: true, clockMonths: null, holdsPassport: true, banMonths: 60 });
    // Bans and detection: 10 years and 12 months in the UK, 20 years in Canada; 3%, 3%, 6%, 4%.
    expect(content.status["status.uk-overstayer"]).toMatchObject({ banMonths: 120, overstayBanMonths: 12, detectBp: 300 });
    expect(content.status["status.ca-overstayer"]).toMatchObject({ banMonths: 240, detectBp: 300 });
    expect(content.status["status.uae-irregular"]?.detectBp).toBe(600);
    expect(content.status["status.eu-irregular"]?.detectBp).toBe(400);
    // Fees and months from the world: £3,226, £1,709, £1,865, £1,035 a year, C$630; 24, 60, 36, 36 months.
    expect(content.var["var.uk-settle-fee"]?.start).toBe(322600);
    expect(content.var["var.uk-citizen-fee"]?.start).toBe(170900);
    expect(content.var["var.uk-skilled-renew-fee"]?.start).toBe(186500);
    expect(content.var["var.uk-surcharge-year"]?.start).toBe(103500);
    expect(content.var["var.ca-citizen-fee"]?.start).toBe(63000);
    expect(content.var["var.uk-graduate-months"]?.start).toBe(24);
    expect(content.var["var.uk-settle-months"]?.start).toBe(60);
    expect(content.var["var.uk-talent-settle-months"]?.start).toBe(36);
    expect(content.var["var.ca-settle-months"]?.start).toBe(36);
  });
});
