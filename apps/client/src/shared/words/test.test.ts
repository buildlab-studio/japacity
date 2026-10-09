// The English test's chance and result in words (docs/rules/world.md R-WORLD-006, R-WORLD-008; the fifth
// review), checked against the engine's own sittings on the real content.
import { content, text } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame, recordedGame, viewAfter } from "../testing/fixtures";
import { formatBand } from "./format";
import { jobsWords } from "./jobs";
import { tidyLines } from "./lines";
import { bandChanceBp, bandNeeded, bandResultLine, englishOf, ISSUED_BAND_SHORT, possibleBands, testChance } from "./test";
import { words } from "./text";

const PAPER = "document.english-test";

/** Ada's new life with this much English, as a view: the same life on each seed. */
function adaWith(english: number, seed = "probe") {
  const game = newGame("scenario.ada", seed);
  const have = englishOf(game.view());
  return { game, view: viewAfter(game, [{ type: "quality/add", quality: "quality.english", amount: english - have }]) };
}

describe("the English test's chance", () => {
  test("[R-WORLD-006] given the band the route asks for, when it is read, then it is the chapter's English item, band 6.0, the nudge's figure", () => {
    expect(bandNeeded()).toBe(60);
    expect(text["chapter.build-the-file.item.english"]).toContain(formatBand(bandNeeded()));
  });

  test("[R-WORLD-006] given English at each edge of the noise, when the chance of 6.0 is read, then none, one, two and all three of the draws reach it", () => {
    // 40 plus 35 per hundred, a half band either way, rounded down to a half band.
    expect(bandChanceBp(42)).toBe(0);
    expect(bandChanceBp(43)).toBe(3333);
    expect(bandChanceBp(57)).toBe(3333);
    expect(bandChanceBp(58)).toBe(6666);
    expect(bandChanceBp(71)).toBe(6666);
    expect(bandChanceBp(72)).toBe(10_000);
  });

  test("[R-WORLD-006] given Ada on twelve seeds, when the engine sits the test for her, then every band it gives is one the chance counts, and Ada's 55 at the start reads a fair chance", () => {
    const { view } = adaWith(55);
    expect(englishOf(view)).toBe(55);
    expect(testChance(view).band).toBe("fair");
    const seen = new Set<number>();
    for (let seed = 0; seed < 12; seed += 1) {
      const { game } = adaWith(55, `seed-${String(seed)}`);
      viewAfter(game, [{ type: "document/request", document: PAPER }]);
      for (let month = 0; month < 6 && game.view().documents.find((paper) => paper.id === PAPER)?.state !== "held"; month += 1) game.endTurn([]);
      const held = game.view().documents.find((paper) => paper.id === PAPER);
      expect(held?.state).toBe("held");
      expect(possibleBands(englishOf(game.view()))).toContain(held?.value);
      seen.add(held?.value ?? -1);
    }
    expect([...seen].some((band) => band >= bandNeeded())).toBe(true);
    expect([...seen].some((band) => band < bandNeeded())).toBe(true);
  });

  test("[R-WORLD-006] given English at a long shot, a fair chance and likely, when the card's words are read, then each says the chance of 6.0 in the jobs' words and only the long shot says to study first", () => {
    const long = testChance(adaWith(40).view);
    expect(long.words).toBe(`Band 6.0 this sitting: ${jobsWords("jobs.chance.long").toLowerCase()}.`);
    expect(long.study).toBe("Study first: a month of study lifts the chance.");
    const fair = testChance(adaWith(55).view);
    expect(fair.words).toBe(`Band 6.0 this sitting: ${jobsWords("jobs.chance.fair").toLowerCase()}.`);
    expect(fair.study).toBeNull();
    const likely = testChance(adaWith(75).view);
    expect(likely.words).toBe(`Band 6.0 this sitting: ${jobsWords("jobs.chance.likely").toLowerCase()}.`);
    expect(likely.study).toBeNull();
  });

  test("[R-WORLD-006] given a month of study, when the chance is read again, then it is no lower and study's English is what lifts it", () => {
    const study = content.activity["activity.study-english"];
    const lift = study?.effects.find((effect) => effect.type === "quality/add" && effect.quality === "quality.english");
    if (lift?.type !== "quality/add") throw new Error("Study lifts no English.");
    expect(lift.amount).toBeGreaterThan(0);
    expect(bandChanceBp(43 - lift.amount)).toBeLessThan(bandChanceBp(43));
  });
});

describe("the English result", () => {
  const issued = (band: number): ReportLine => ({ key: "line.document.issued-band", params: { document: PAPER, band }, tone: "good", attention: true, counts: [] });

  test("[R-WORLD-008] given a band under 6.0, when the result is told, then it says the band, that the route needs 6.0, and to study and sit again", () => {
    const line = bandResultLine(issued(50));
    expect(line.key).toBe(ISSUED_BAND_SHORT);
    expect(line.tone).toBe("bad");
    expect(line.attention).toBe(true);
    expect(words(line.key, line.params)).toBe("Band 5.0. The route needs 6.0: study and sit again.");
  });

  test("[R-WORLD-008] given a band of 6.0 or more, when the result is told, then the plain line stands", () => {
    expect(bandResultLine(issued(60))).toEqual(issued(60));
    expect(bandResultLine(issued(55)).key).toBe(ISSUED_BAND_SHORT);
  });

  test("[R-WORLD-008] given Ada's careful life, when her result is told by the engine, then it reaches 6.0 and its line is the plain one", () => {
    const game = recordedGame("ada-careful");
    expect(game.view().documents.find((paper) => paper.id === PAPER)?.value).toBeGreaterThanOrEqual(bandNeeded());
    // The tidy lines that reach the results keep the engine's key for a band that reaches the route's.
    expect(tidyLines([issued(60)]).map((line) => bandResultLine(line).key)).toEqual(["line.document.issued-band"]);
  });
});
