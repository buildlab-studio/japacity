// The asks that could come too often or at the wrong time, read from content:
// how often they may come, and when they may not.
import { describe, expect, test } from "vitest";

import { content } from "../index";

function entry(id: string) {
  const found = content.offer[id as keyof typeof content.offer];
  if (found === undefined) throw new Error(`No offer ${id}.`);
  return found;
}

describe("asks that fit the life", () => {
  test("[R-WORLD-003] given the salary loan, when its conditions are read, then it keeps the savings circle's own rule: never while a route is granted or flown on", () => {
    const leaving = entry("offer.join-ajo").when.find((requirement) => requirement.type === "not" && requirement.of.type === "any");
    expect(leaving).toBeDefined();
    expect(entry("offer.salary-loan").when).toContainEqual(leaving);
  });

  test("[R-WORLD-003] [R-OFFER-001] given the harvest pledge, when its cooldown is read, then it cannot come a second time within twelve months", () => {
    expect(entry("offer.harvest").cooldown).toBeGreaterThanOrEqual(12);
  });

  test("[R-WORLD-003] given Terna's send-off, when its limit is read, then he leaves once in a life", () => {
    expect(entry("offer.send-off-party").maxTimes).toBe(1);
  });
});
