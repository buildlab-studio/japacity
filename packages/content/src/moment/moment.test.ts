import { describe, expect, test } from "vitest";

import { content, text } from "../index";
import { momentText } from "./moment.text";

const KINDS = ["granted", "refused", "agent", "deposit", "robbed", "won", "landed", "chapter"];
/** The words of a bank alert, a receipt, a transfer or a government letter (share.md R-SHARE-006, text.md). */
const BANK_LOOK = /alert|credit|debit|transaction|receipt|\bref(?:erence)?\b|account|balance|transfer|\bbank|embassy|home office|ministry|stamp|successful|\bNGN\b|\bGBP\b/i;

describe("the screenshot moments' words", () => {
  test("[R-MOMENT-002] given every moment, when its words are looked up, then it has a kicker and a caption, and the sign-off is the game's address", () => {
    for (const kind of KINDS) {
      expect(text[`moment.${kind}.kicker`]?.trim()).toBeTruthy();
      expect(Object.keys(momentText).some((key) => key.startsWith(`moment.${kind}.caption`))).toBe(true);
    }
    expect(text["moment.address"]).toBe("japacity.app");
    expect(text["moment.address"]).toBe(text["share.address"]);
    expect(text["moment.mark"]).toBe("Japacity");
  });

  test("[R-MOMENT-002] given every route and every country a flight lands in, when the granted and landed lines are looked up, then each has its own words", () => {
    const routes = Object.values(content.route).filter((route) => route.gate !== "road");
    expect(routes.filter((route) => (text[`moment.granted.line.${route.id}`] ?? "").trim() === "").map((route) => route.id)).toEqual([]);
    expect(routes.filter((route) => (text[`moment.landed.line.${route.country ?? ""}`] ?? "").trim() === "").map((route) => route.id)).toEqual([]);
  });

  test("[R-MOMENT-004] given every word a moment card can say, when they are searched, then none reads as a bank alert, a receipt, a transfer or a government letter", () => {
    expect(Object.entries(momentText).filter(([, words]) => BANK_LOOK.test(words)).map(([key]) => key)).toEqual([]);
    // The chapter's own closing lines stand on its card too.
    for (const id of Object.keys(content.chapter)) expect(text[`${id}.close`] ?? "").not.toMatch(BANK_LOOK);
  });

  test("[R-MOMENT-005] given every moment's words, when they are read, then none shouts, none carries a dash, and no line carries a brace the card does not fill", () => {
    expect(Object.entries(momentText).filter(([, words]) => /[!\u2013\u2014]/.test(words)).map(([key]) => key)).toEqual([]);
    expect(Object.entries(momentText).filter(([key, words]) => key.includes(".line") && /[{}]/.test(words)).map(([key]) => key)).toEqual([]);
  });
});
