import { describe, expect, test } from "vitest";

import { content } from "../index";

describe("obligations abroad", () => {
  test("[engine:content-checked-before-play] given every obligation that needs credit or has a credit ladder, when it is read, then it reports to the file and its ladder falls rung by rung", () => {
    const credited = Object.values(content.obligation).filter((entry) => entry.creditMin !== undefined || entry.rateByCredit !== undefined);
    expect(credited.length).toBeGreaterThan(3);
    for (const entry of credited) {
      expect(entry.reportsToCredit).toBe(true);
      const mins = (entry.rateByCredit ?? []).map((rung) => rung.min);
      expect(mins).toEqual([...mins].sort((a, b) => b - a));
    }
  });

  test("[engine:content-checked-before-play] given the abroad obligations, when figures from abroad-money.md are read back, then each matches the page", () => {
    // UK: upkeep £15, the phone's pay as you go alone (abroad-money:arrival-opens-upkeep-and-room), a room £670, a flat £950 at credit 20, a phone £25 at credit 10.
    expect(content.obligation["obligation.upkeep-uk"]).toMatchObject({ type: "upkeep", currency: "GBP", amount: 1500 });
    expect(content.obligation["obligation.rent-room-uk"]).toMatchObject({ type: "rent", amount: 67000 });
    expect(content.obligation["obligation.rent-room-uk"]?.creditMin).toBeUndefined();
    expect(content.obligation["obligation.rent-flat-uk"]).toMatchObject({ type: "rent", amount: 95000, creditMin: 20 });
    expect(content.obligation["obligation.phone-uk"]).toMatchObject({ type: "phone", amount: 2500, creditMin: 10 });
    // Canada: C$30 (the prepaid phone alone, abroad-money:arrival-opens-upkeep-and-room), C$900, C$1,700, C$45. The UAE: AED 50 and AED 1,200. Italy: €10 and €350.
    expect(content.obligation["obligation.upkeep-canada"]?.amount).toBe(3000);
    expect(content.obligation["obligation.rent-room-canada"]?.amount).toBe(90000);
    expect(content.obligation["obligation.rent-flat-canada"]?.amount).toBe(170000);
    expect(content.obligation["obligation.phone-canada"]?.amount).toBe(4500);
    expect(content.obligation["obligation.upkeep-uae"]?.amount).toBe(5000);
    expect(content.obligation["obligation.rent-room-uae"]?.amount).toBe(120000);
    expect(content.obligation["obligation.upkeep-italy"]?.amount).toBe(1000);
    expect(content.obligation["obligation.rent-room-italy"]?.amount).toBe(35000);
    // Tuition in three instalments, every three months, one month's grace, then the status lapses.
    expect(content.obligation["obligation.tuition"]).toMatchObject({ type: "tuition", term: 3, everyMonths: 3, grace: 1, sink: "fee-school" });
    expect(content.obligation["obligation.tuition"]?.onDefault).toEqual([{ type: "status/lose" }]);
  });

  test("[engine:content-checked-before-play] given the car, when figures from car.md and credit.md are read back, then each matches the page", () => {
    const car = content.obligation["obligation.car"];
    // £9,500, 10% down, 30% at the end, 55% on resale, a third, a half, three months to court.
    expect(car?.car).toEqual({ price: 950000, depositBp: 1000, finalBp: 3000, resaleBp: 5500, courtThirdBp: 3333, handBackBp: 5000, courtMonths: 3, shortfall: "obligation.car-shortfall" });
    expect(car).toMatchObject({ type: "car", term: 36, grace: 2, creditMin: 30, sink: "car-payment", interestSink: "loan-interest" });
    // 0.5% a month at 70, 0.9% at 50, 1.2% at 30.
    expect(car?.rateByCredit).toEqual([
      { min: 70, rateBp: 50 },
      { min: 50, rateBp: 90 },
      { min: 30, rateBp: 120 },
    ]);
    expect(content.obligation["obligation.car-shortfall"]).toMatchObject({ type: "loan", term: 12, rateBp: 0, sink: "loan-repay" });
    // The credit numbers: +3, -12, -30, +1 a month up to 40, 72 months, less 20 on return.
    expect(content.tuning.credit).toEqual({ onTime: 3, onMiss: 12, onDefault: 30, drift: 1, driftTo: 40, judgmentMonths: 72, judgmentCap: 20, returnPenalty: 20, cleanMonths: 12 });
  });

  test("[engine:content-checked-before-play] given a flat that is defaulted, when its effects are read, then the tenant goes back to a room in the same country", () => {
    expect(content.obligation["obligation.rent-flat-uk"]?.onDefault).toEqual([
      { type: "obligation/close", obligationType: "rent" },
      { type: "obligation/open", obligation: "obligation.rent-room-uk" },
    ]);
    expect(content.obligation["obligation.rent-flat-canada"]?.onDefault).toContainEqual({ type: "obligation/open", obligation: "obligation.rent-room-canada" });
  });
});
