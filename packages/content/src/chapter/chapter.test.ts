// The Gulf file in content: chapter:chapters-follow-lean-route: there is no honest way to the Gulf
// without a passport, so its file asks for one before the medical. The only way out without papers is the road.
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { content, text } from "../index";

const GULF_FILE: Id<"chapter"> = "chapter.build-the-file-gulf";

describe("the Gulf file", () => {
  test("[chapter:chapters-follow-lean-route] given the Gulf file, when its items are read, then the passport comes first, before the medical, and reads the passport held", () => {
    const file = content.chapter[GULF_FILE]!;
    expect(file.items.map((item) => item.id)).toEqual(["passport", "medical", "agent", "contract"]);
    expect(file.items[0]!.requirement).toEqual({ type: "document/held", document: "document.passport" });
  });

  test("[chapter:chapters-follow-lean-route] given the Gulf file's passport step, when its words are read, then it says what to do, where, and how the wait goes, and the file's opening names the passport", () => {
    expect(text[`${GULF_FILE}.item.passport`]).toBe("Get your passport");
    // The passport at Immigration: the passport office in Ikoyi, not the box at home.
    expect(text[`${GULF_FILE}.item.passport.nudge`]).toBe("Apply for your passport in Ikoyi");
    expect(text[`${GULF_FILE}.item.passport.started`]).toContain("{when}");
    expect(text[`${GULF_FILE}.item.passport.planned`]).toBeDefined();
    expect(text[`${GULF_FILE}.open`]).toMatch(/passport/);
  });

  test("[chapter:chapters-follow-lean-route] given the Gulf contract and the road, when their checklists are read, then the Gulf asks for the passport and the road asks for none", () => {
    const names = (route: Id<"route">) => JSON.stringify(content.route[route]!.checklist).includes("document.passport");
    expect(names("route.gulf-contract")).toBe(true);
    expect(names("route.road")).toBe(false);
  });
});

describe("the first chapter's closing line", () => {
  // The line says it plainly, with no figure of speech to decode.
  test("[chapter:met-items-close-the-chapter] [moment:words-in-game-voice] given the first chapter, when it closes, then its closing line says the salary and the wish to leave plainly, with no dash and no shout", () => {
    expect(text["chapter.find-your-feet.close"]).toBe("You have a salary. Now you know what you want: to leave.");
    expect(text["chapter.find-your-feet.close"]).not.toMatch(/[!\u2013\u2014]/);
  });
});
