import { describe, expect, test } from "vitest";

import { text } from "../index";
import { recurringPeople } from "./person.recurring.data";

describe("the recurring people", () => {
  test("[R-PEOPLE-053] [R-ADVICE-010] given the recurring people, when they are listed, then there is one FX man, one landlord, one auntie, one agent at the desk, three at the stop and one adviser, each from a different people", () => {
    expect(recurringPeople.map((person) => person.role).sort()).toEqual(["adviser", "agent", "auntie", "fx", "landlord", "middleman", "runner", "tout"]);
    expect(new Set(recurringPeople.map((person) => person.people)).size).toBe(recurringPeople.length);
  });

  test("[R-PEOPLE-053] given each recurring person, when their words are looked up, then they have a name, a blurb, and three to five quotable lines with nothing past the last", () => {
    for (const person of recurringPeople) {
      const at = `recurring.${person.role}`;
      expect(text[`${at}.name`]).toMatch(new RegExp(`\\b${person.name}$`));
      expect((text[`${at}.blurb`] ?? "").trim()).not.toBe("");
      expect(person.lines).toBeGreaterThanOrEqual(3);
      expect(person.lines).toBeLessThanOrEqual(5);
      for (let line = 1; line <= person.lines; line += 1) expect((text[`${at}.line.${String(line)}`] ?? "").trim()).not.toBe("");
      expect(text[`${at}.line.${String(person.lines + 1)}`]).toBeUndefined();
      expect(text[`${at}.line.0`]).toBeUndefined();
    }
  });

  test("[R-PEOPLE-053] given the FX man and the agent, when their lines are read, then each carries what makes them quotable: a rate just for you, and somebody they know", () => {
    const lines = (role: string) => Object.entries(text).filter(([key]) => key.startsWith(`recurring.${role}.line.`)).map(([, words]) => words).join(" ");
    expect(lines("fx")).toMatch(/[Jj]ust for you/);
    expect(lines("agent")).toMatch(/know somebody|knows somebody/);
  });
});
