// The words and the chapters of life abroad, across the tables.
import { describe, expect, test } from "vitest";

import { content, text, textTables } from "./index";

/** The keys among `keys` that have no words. */
function missingWords(keys: string[]): string[] {
  return keys.filter((key) => (text[key] ?? "").trim() === "");
}

describe("words for life abroad", () => {
  test("[engine:content-checked-before-play] given every country, status, goal and the new entries of the older kinds, when their words are looked up, then each has a name", () => {
    const ids = [
      ...Object.keys(content.country),
      ...Object.keys(content.status),
      ...Object.keys(content.goal),
      "quality.care",
      "quality.driving",
      "document.home-licence",
      "document.uk-licence",
      "document.nmc-pin",
      "document.medical",
      "activity.job-nurse",
    ];
    expect(ids.length).toBeGreaterThan(30);
    expect(missingWords(ids.map((id) => `${id}.name`))).toEqual([]);
  });

  test("[engine:content-checked-before-play] given every status, when its blurb is looked up, then there is one line saying what it lets you do", () => {
    const keys = Object.keys(content.status).map((id) => `${id}.blurb`);
    expect(missingWords(keys)).toEqual([]);
    expect(keys.filter((key) => (text[key] ?? "").includes("\n"))).toEqual([]);
  });

  test("[engine:content-checked-before-play] given the words files of life abroad, when their keys are read, then none is a report line, which the kinds add", () => {
    const files = ["activityAbroad", "country", "status", "goal", "offerAbroad"];
    const lines = files.flatMap((file) => Object.keys(textTables[file] ?? {}).filter((key) => key.startsWith("line.")));
    expect(files.filter((file) => textTables[file] === undefined)).toEqual([]);
    expect(lines).toEqual([]);
  });

  test("[engine:content-checked-before-play] given every offer abroad or on the way home, when its group is read, then it is one of the two and it has words for every choice and sign", () => {
    const offers = Object.values(content.offer).filter((offer) => offer.group === "return" || offer.group === "abroad");
    expect(offers.map((offer) => offer.id)).toEqual([
      "offer.returnee-question",
      "offer.returnee-business",
      "offer.returnee-hire",
      "offer.returnee-leave-again",
      "offer.sponsor-licence-lost",
      // undertaking:social-assistance-offer: social assistance in Canada.
      "offer.ca-assistance",
      "offer.court-date",
    ]);
    const keys = offers.flatMap((offer) => [
      `${offer.id}.name`,
      `${offer.id}.title`,
      `${offer.id}.body`,
      ...offer.choices.map((choice) => `${offer.id}.choice.${choice.id}`),
      ...offer.signs.map((sign) => `${offer.id}.sign.${sign.key}`),
    ]);
    expect(missingWords(keys)).toEqual([]);
    // The returnee offers come up at home, the sponsor's at work abroad (place:entries-legal-by-where), assistance in Canada (undertaking:social-assistance-offer), and the court date abroad (health:forced-months-warned-ahead).
    expect(offers.map((offer) => offer.where)).toEqual(["home", "home", "home", "home", "abroad", "abroad", "abroad"]);
  });
});

describe("chapters 5 and 6", () => {
  test("[engine:content-checked-before-play] given the chapters, when they are put in order, then Landing and Secure follow the send-off with the page's items", () => {
    const ordered = Object.values(content.chapter).sort((a, b) => a.order - b.order);
    expect(ordered.map((chapter) => chapter.id).slice(-3)).toEqual(["chapter.send-off", "chapter.landing", "chapter.secure"]);
    expect(content.chapter["chapter.landing"]?.items.map((item) => item.id)).toEqual(["room", "job", "status", "request", "file"]);
    expect(content.chapter["chapter.landing"]?.items.find((item) => item.id === "file")?.requirement).toEqual({ type: "credit/min", value: 3 });
    // One `any` item, so one path closes it (chapter.md).
    const secure = content.chapter["chapter.secure"]?.items ?? [];
    expect(secure).toHaveLength(1);
    expect(secure[0]?.requirement.type).toBe("any");
  });

  test("[engine:content-checked-before-play] given chapters 5 and 6, when their words are read, then the opening and closing lines are the page's", () => {
    expect(text["chapter.landing.open"]).toBe("Cold. A room with a lock. A number that is not yours yet.");
    expect(text["chapter.landing.close"]).toBe("You have a key, a payslip and a name on a bill. Nobody here knows your father.");
    expect(text["chapter.secure.open"]).toBe("The clocks are long now. Keep the rules, keep the job, keep sending.");
    expect(text["chapter.secure.close"]).toBe("Whatever this is, it is yours to keep. The door is open both ways.");
  });
});
