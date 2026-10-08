import { describe, expect, test } from "vitest";

import { badNews } from "../comedy/comedy.check";
import { content, text } from "../index";
import { institutionProblems } from "../person/person.names.check";
import { familyFeed, familyNames, familyPosts, travelKnown } from "./family.data";

describe("the family group feed", () => {
  test("[R-ENGINE-014] given every post, when its words are looked up, then it has text, its sender has a name, and no two posts share an id", () => {
    expect(familyPosts.filter((post) => (text[`${post.id}.text`] ?? "").trim() === "").map((post) => post.id)).toEqual([]);
    expect(familyPosts.filter((post) => text[`family.from.${post.from}`] === undefined).map((post) => post.id)).toEqual([]);
    const ids = familyPosts.map((post) => post.id);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
    const words = Object.keys(text).filter((key) => /^family\.[a-z0-9-]+\.text$/.test(key));
    expect(words.sort()).toEqual(ids.map((id) => `${id}.text`).sort());
  });

  test("[R-ENGINE-014] given the feed, when it is read, then it carries forwarded prayers, a cousin's business and billing, and stays small", () => {
    const kinds = new Set(familyPosts.map((post) => post.kind));
    expect([...kinds].sort()).toEqual(["billing", "business", "chatter", "prayer"]);
    expect(familyPosts.filter((post) => post.kind === "business").every((post) => post.from === "cousin")).toBe(true);
    expect(familyPosts.length).toBeLessThanOrEqual(24);
    expect(familyFeed.perMonth).toBe(1);
  });

  test("[R-ENGINE-014] given every post keyed to a moment, when the moment is read, then it is a report line with words and never bad news: no refusal, no loss, nothing on the road", () => {
    const keyed = familyPosts.filter((post) => post.after !== null);
    expect(keyed.length).toBeGreaterThan(0);
    expect(keyed.filter((post) => !post.after!.startsWith("line.") || text[post.after!] === undefined).map((post) => post.id)).toEqual([]);
    expect(keyed.filter((post) => badNews(post.after!, text[post.after!] ?? "")).map((post) => post.id)).toEqual([]);
  });

  test("[R-ENGINE-014] given every billing post, when its moment is read, then it waits for a line after which the family knows you are travelling", () => {
    const billing = familyPosts.filter((post) => post.kind === "billing");
    expect(billing.length).toBeGreaterThanOrEqual(3);
    expect(billing.filter((post) => post.after === null || !travelKnown.includes(post.after)).map((post) => post.id)).toEqual([]);
    expect(travelKnown.filter((key) => text[key] === undefined)).toEqual([]);
  });

  test("[R-ENGINE-014] given every fixed life, when its family is looked up, then it has a named aunt and cousin, and the senders the family names have words for both a name and a plain relation", () => {
    const fixed = Object.keys(content.scenario).filter((id) => id !== "scenario.prologue");
    expect(fixed.filter((life) => familyNames[life as keyof typeof familyNames]?.aunt === undefined || familyNames[life as keyof typeof familyNames]?.cousin === undefined)).toEqual([]);
    for (const sender of ["aunt", "cousin"]) {
      expect(text[`family.from.${sender}`]).toContain("{name}");
      expect(text[`family.from.${sender}.plain`]).not.toContain("{");
    }
  });

  test("[R-ENGINE-014] given the family's words, when an institution is named, then no crime or fraud is beside it", () => {
    const words = Object.fromEntries(Object.entries(text).filter(([key]) => key.startsWith("family.")));
    expect(institutionProblems(words)).toEqual([]);
  });
});
