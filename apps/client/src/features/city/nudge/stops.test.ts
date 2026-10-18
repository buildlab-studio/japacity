import { describe, expect, test } from "vitest";

import { engineView } from "../../../shared/testing/fixtures";
import { OPENS_WITH, stopReached } from "./stops";

describe("stops the story opens", () => {
  test("[world:map-is-painted-lagos] given the first chapter, when the stops are read, then the test centre, the bank's office, the clinic, the visa centre and the airport are not yet, the rest open; each opens with its chapter and stays open after; abroad nothing is held", () => {
    const view = engineView();
    const first = { current: "chapter.find-your-feet" as const, items: [], done: [], closes: false, next: null };
    for (const place of Object.keys(OPENS_WITH)) expect(stopReached(first, "home", place)).toBe(false);
    expect(stopReached(first, "home", "place.ojuelegba")).toBe(true);
    expect(stopReached(first, "home", "place.computer-village")).toBe(true);
    const file = { current: "chapter.build-the-file" as const, items: [], done: ["chapter.find-your-feet" as const], closes: false, next: null };
    expect(stopReached(file, "home", "place.english-test-centre")).toBe(true);
    expect(stopReached(file, "home", "place.agent-office")).toBe(true);
    expect(stopReached(file, "home", "place.visa-centre")).toBe(false);
    const decision = { current: "chapter.decision-day" as const, items: [], done: ["chapter.find-your-feet" as const, "chapter.build-the-file" as const], closes: false, next: null };
    expect(stopReached(decision, "home", "place.english-test-centre")).toBe(true);
    expect(stopReached(decision, "home", "place.olokun-office")).toBe(true);
    expect(stopReached(decision, "home", "place.airport-lagos")).toBe(false);
    const sendOff = { current: "chapter.send-off" as const, items: [], done: [...decision.done, "chapter.decision-day" as const], closes: false, next: null };
    expect(stopReached(sendOff, "home", "place.airport-lagos")).toBe(true);
    expect(stopReached(first, "abroad", "place.airport-lagos")).toBe(true);
    expect(view.place.where).toBe("home");
  });

  test("[world:map-is-painted-lagos] [chapter:chapters-follow-lean-route] given a chapter standing in for a base by route, when the stops are read, then the base's stops open with it and stay open once it is done", () => {
    const careFile = { current: "chapter.build-the-file-care" as const, items: [], done: ["chapter.find-your-feet" as const], closes: false, next: null };
    expect(stopReached(careFile, "home", "place.english-test-centre")).toBe(true);
    expect(stopReached(careFile, "home", "place.agent-office")).toBe(true);
    expect(stopReached(careFile, "home", "place.visa-centre")).toBe(false);
    const gulfDecision = { current: "chapter.decision-day-gulf" as const, items: [], done: ["chapter.find-your-feet" as const, "chapter.build-the-file-gulf" as const], closes: false, next: null };
    expect(stopReached(gulfDecision, "home", "place.english-test-centre")).toBe(true);
    expect(stopReached(gulfDecision, "home", "place.tb-clinic")).toBe(true);
    expect(stopReached(gulfDecision, "home", "place.visa-centre")).toBe(true);
    expect(stopReached(gulfDecision, "home", "place.airport-lagos")).toBe(false);
  });

  test("[world:map-is-painted-lagos] [prologue:archetype-presets-answers] given a life whose own first step is at a place its chapter has not reached, when the stops are read, then that place is open and the others its chapter holds stay not yet", () => {
    const first = { current: "chapter.find-your-feet" as const, items: [], done: [], closes: false, next: null };
    expect(stopReached(first, "home", "place.tb-clinic", ["place.tb-clinic"])).toBe(true);
    expect(stopReached(first, "home", "place.visa-centre", ["place.tb-clinic"])).toBe(false);
  });
});
