import { describe, expect, test } from "vitest";

import { text, textTables } from "../index";
import { versionKey, versionCount } from "./comedy";
import { badNews, reportPlain } from "./comedy.check";
import { spendingLines, versionedLines, VERSIONS } from "./comedy.data";

const VERSION_KEY = /^(line\.[a-z-]+\.[a-z0-9.-]+)\.v([0-9]+)$/;
const BRACE = /\{([A-Za-z][\w-]*)\}/g;
const braces = (words: string) => [...words.matchAll(BRACE)].map((match) => match[1]).sort();
const plain = { onRoad: false, broke: false, badNews: false };

describe("joke versions of report lines", () => {
  test("[R-ENGINE-014] given every line with versions, when its words are looked up, then the plain line has words and every version from 2 to its count does, with nothing past the last", () => {
    const missing: string[] = [];
    for (const [key, count] of Object.entries(versionedLines)) {
      if (text[key] === undefined) missing.push(key);
      for (let version = 2; version <= count; version += 1) if (text[`${key}.v${String(version)}`] === undefined) missing.push(`${key}.v${String(version)}`);
      if (text[`${key}.v${String(count + 1)}`] !== undefined) missing.push(`${key}.v${String(count + 1)} is past the count`);
    }
    expect(missing).toEqual([]);
  });

  test("[R-ENGINE-014] given every versioned line, when its count is read, then it has three to five versions, about a dozen lines carry them, and every version key belongs to a listed line", () => {
    const counts = Object.values(versionedLines);
    expect(counts.filter((count) => count < VERSIONS.min || count > VERSIONS.max)).toEqual([]);
    expect(counts.length).toBeGreaterThanOrEqual(10);
    expect(counts.length).toBeLessThanOrEqual(14);
    const stray = Object.keys(text).filter((key) => {
      const match = VERSION_KEY.exec(key);
      return match !== null && (versionedLines[match[1]!] ?? 1) < Number(match[2]);
    });
    expect(stray).toEqual([]);
  });

  test("[R-ENGINE-014] given every version, when its braces are read, then it names exactly the figures its plain line names, so a joke never needs a param the line lacks", () => {
    const wrong = Object.entries(versionedLines).flatMap(([key, count]) =>
      Array.from({ length: count - 1 }, (_, index) => `${key}.v${String(index + 2)}`).filter((version) => braces(text[version] ?? "").join() !== braces(text[key] ?? "").join()),
    );
    expect(wrong).toEqual([]);
  });

  test("[R-ENGINE-014] given every line in the game, when it is bad news (a refusal, a robbery, an illness, a loss, the road, being poor), then it has only its plain version", () => {
    const lines = Object.entries(text).filter(([key]) => key.startsWith("line.") && !VERSION_KEY.test(key));
    const bad = lines.filter(([key, words]) => badNews(key, words)).map(([key]) => key);
    expect(bad.length).toBeGreaterThan(50);
    expect(bad.filter((key) => versionCount(key) > 1)).toEqual([]);
    expect(Object.keys(versionedLines).filter((key) => badNews(key, text[key] ?? ""))).toEqual([]);
  });

  test("[R-ENGINE-014] given the lines bad news is told by, when they are checked, then the refusal, the robbery, the illness, a loss and the road are each found", () => {
    for (const key of ["line.route.refused", "line.activity.robbed", "line.quality.run-down", "line.route.road-lost", "line.route.road-go", "line.place.on-road", "line.obligation.evicted", "line.activity.hunt-missed"]) {
      expect([key, badNews(key, text[key] ?? "")]).toEqual([key, true]);
    }
  });

  test("[R-ENGINE-014] given the words of each joke, when searched, then none uses an exclamation mark, and every joke version lives in the comedy words file", () => {
    const versions = Object.keys(text).filter((key) => VERSION_KEY.test(key));
    expect(versions.filter((key) => (text[key] ?? "").includes("!"))).toEqual([]);
    expect(versions.filter((key) => !(key in (textTables["comedy"] ?? {})))).toEqual([]);
  });

  test("[R-ENGINE-014] given the spending lines, when read, then each is a versioned line about paying for life, which the simulation tells as money going out", () => {
    expect(spendingLines.filter((key) => versionCount(key) === 1)).toEqual([]);
    expect(spendingLines.filter((key) => !key.startsWith("line.wallet."))).toEqual([]);
  });
});

describe("which version is shown", () => {
  test("[R-ENGINE-014] given a line with four versions, when the draw runs over its edges, then 0 is plain, 1 to 3 are the jokes, 4 comes round to plain, and a negative draw still lands on a version", () => {
    const key = "line.wallet.upkeep";
    expect(versionCount(key)).toBe(4);
    expect([0, 1, 2, 3, 4].map((draw) => versionKey(key, draw, plain))).toEqual([key, `${key}.v2`, `${key}.v3`, `${key}.v4`, key]);
    expect(versionKey(key, -1, plain)).toBe(`${key}.v2`);
  });

  test("[R-ENGINE-014] given a line without versions, a month on the road, a character who is broke, or a month with bad news in it, when any draw is made, then the plain line is shown", () => {
    for (const draw of [0, 1, 2, 3, 99]) {
      expect(versionKey("line.route.refused", draw, plain)).toBe("line.route.refused");
      expect(versionKey("line.wallet.upkeep", draw, { onRoad: true, broke: false, badNews: false })).toBe("line.wallet.upkeep");
      expect(versionKey("line.wallet.upkeep", draw, { onRoad: false, broke: true, badNews: false })).toBe("line.wallet.upkeep");
      expect(versionKey("line.wallet.upkeep", draw, { onRoad: false, broke: false, badNews: true })).toBe("line.wallet.upkeep");
    }
  });
});

describe("a month with bad news in it", () => {
  test("[R-ENGINE-014] given a month whose report holds a refusal, a robbery or a road line beside a salary, when it is read, then it is shown plain; a month of salary and rent alone is not", () => {
    expect(reportPlain(["line.activity.salary", "line.route.refused"], text)).toBe(true);
    expect(reportPlain(["line.activity.robbed", "line.wallet.upkeep"], text)).toBe(true);
    expect(reportPlain(["line.news.delivered", "line.place.returned-road"], text)).toBe(true);
    expect(reportPlain(["line.interview.doubted", "line.activity.salary"], text)).toBe(true);
    expect(reportPlain(["line.activity.salary", "line.wallet.upkeep", "line.wallet.rent", "line.news.delivered"], text)).toBe(false);
    expect(reportPlain([], text)).toBe(false);
  });
});

describe("bad news told in the past tense", () => {
  // The results tell the month gone in the past tense: a line that
  // turned bad news into the past must still be found as bad news, so its month is shown plain.
  test("[R-TEXT-002] given the bad news the results now tell in the past tense, when each line is read, then it is still bad news", () => {
    const past = ["line.route.school-rejected", "line.activity.driving-failed", "line.activity.lotto-lost", "line.activity.pay-withheld", "line.activity.bet-lost", "line.wallet.remit-lost"];
    expect(past.filter((key) => !badNews(key, text[key] ?? ""))).toEqual([]);
    expect(badNews("line.test.past", "The school turned you down. The examiner said no. Nothing came in. The pay did not come. It never arrived.")).toBe(true);
    // The kiosk's draw lost is said as "Your ticket did not win."
    for (const said of ["turned you down", "said no", "Nothing came in", "did not come", "never arrived", "did not win"]) expect(badNews("line.test.one", `Then: ${said}.`)).toBe(true);
  });
});

describe("officialdom and the cards", () => {
  test("[R-ENGINE-014] given the refusal letter, the bank queue, the embassy page and the cards, when their closing lines are looked up, then each has words and none jokes with an exclamation", () => {
    const keys = ["official.refusal.closer", "official.bank-queue.closer", "official.embassy.closer", "official.refusal.last", "share.chapter.closer", "share.granted.closer"];
    expect(keys.filter((key) => (text[key] ?? "").trim() === "")).toEqual([]);
    expect(keys.filter((key) => (text[key] ?? "").includes("!"))).toEqual([]);
  });
});
