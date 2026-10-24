// The English test's chance and result in words (world:one-action-one-sheet, world:month-end-results-sheet),
// checked against the engine's own sittings on the real content.
import { content, text } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame, recordedGame, viewAfter } from "../testing/fixtures";
import { formatBand } from "./format";
import { tidyLines } from "./lines";
import { bandChanceBp, bandNeeded, bandResultLine, englishOf, ISSUED_BAND_MET, ISSUED_BAND_SHORT, possibleBands, testChance } from "./englishTest";
import { say, words } from "./text";

const PAPER = "document.english-test";

/** The graduate's new life with this much English, as a view: the same life on each seed. */
function graduateWith(english: number, seed = "probe") {
  const game = newGame("scenario.graduate", seed);
  const have = englishOf(game.view());
  return { game, view: viewAfter(game, [{ type: "quality/add", quality: "quality.english", amount: english - have }]) };
}

describe("the English test's chance", () => {
  test("[world:one-action-one-sheet] [route:degree-meets-masters-english] given the band the route asks for, when it is read, then it is the English item of the file that still asks a band, Canada's pool at band 6.0, and the master's file says the degree instead", () => {
    expect(bandNeeded()).toBe(60);
    expect(text["chapter.build-the-file-points.item.english"]).toContain(formatBand(bandNeeded()));
    expect(text["chapter.build-the-file.item.english"]).not.toContain(formatBand(bandNeeded()));
    expect(text["chapter.build-the-file.item.english"]).toContain("degree");
  });

  test("[world:one-action-one-sheet] given English at each edge of the noise, when the chance of 6.0 is read, then none, one, two and all three of the draws reach it", () => {
    // 40 plus 35 per hundred, a half band either way, rounded down to a half band.
    expect(bandChanceBp(42)).toBe(0);
    expect(bandChanceBp(43)).toBe(3333);
    expect(bandChanceBp(57)).toBe(3333);
    expect(bandChanceBp(58)).toBe(6666);
    expect(bandChanceBp(71)).toBe(6666);
    expect(bandChanceBp(72)).toBe(10_000);
  });

  test("[world:one-action-one-sheet] given the graduate on twelve seeds, when the engine sits the test for the life, then every band it gives is one the chance counts, and the graduate's 55 at the start reads a fair chance", () => {
    const { view } = graduateWith(55);
    expect(englishOf(view)).toBe(55);
    expect(testChance(view).band).toBe("fair");
    const seen = new Set<number>();
    for (let seed = 0; seed < 12; seed += 1) {
      const { game } = graduateWith(55, `seed-${String(seed)}`);
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

  test("[world:one-action-one-sheet] given English at a long shot, a fair chance and likely, when the card's words are read, then each says the chance of 6.0 in the jobs' words and only the long shot says to study first", () => {
    const long = testChance(graduateWith(40).view);
    expect(long.words).toBe(`Band 6.0 this sitting: ${say("jobs.chance.long").toLowerCase()}.`);
    expect(long.study).toBe("Study first: a month of study lifts the chance.");
    const fair = testChance(graduateWith(55).view);
    expect(fair.words).toBe(`Band 6.0 this sitting: ${say("jobs.chance.fair").toLowerCase()}.`);
    expect(fair.study).toBeNull();
    const likely = testChance(graduateWith(75).view);
    expect(likely.words).toBe(`Band 6.0 this sitting: ${say("jobs.chance.likely").toLowerCase()}.`);
    expect(likely.study).toBeNull();
  });

  test("[world:one-action-one-sheet] given a month of study, when the chance is read again, then it is no lower and study's English is what lifts it", () => {
    const study = content.activity["activity.study-english"];
    const lift = study?.effects.find((effect) => effect.type === "quality/add" && effect.quality === "quality.english");
    if (lift?.type !== "quality/add") throw new Error("Study lifts no English.");
    expect(lift.amount).toBeGreaterThan(0);
    expect(bandChanceBp(43 - lift.amount)).toBeLessThan(bandChanceBp(43));
  });
});

describe("the English result", () => {
  const issued = (band: number): ReportLine => ({ key: "line.document.issued-band", params: { document: PAPER, band }, tone: "good", attention: true, counts: [] });

  test("[world:month-end-results-sheet] given a band under 6.0, when the result is told, then it says the band, that the route needs 6.0, and to study and sit again", () => {
    const line = bandResultLine(issued(50));
    expect(line.key).toBe(ISSUED_BAND_SHORT);
    expect(line.tone).toBe("bad");
    expect(line.attention).toBe(true);
    expect(words(line.key, line.params)).toBe("Band 5.0. The route needs 6.0: study and sit again.");
  });

  // A pass says it meets the route's band, not only the band.
  test("[world:month-end-results-sheet] given a band of 6.0 or more, when the result is told, then it says the band and that it meets the route's 6.0, in the plain line's tone", () => {
    expect(bandResultLine(issued(60))).toEqual({ ...issued(60), key: ISSUED_BAND_MET, params: { ...issued(60).params, needed: formatBand(bandNeeded()) } });
    expect(words(ISSUED_BAND_MET, bandResultLine(issued(65)).params)).toMatch(/Band 6\.5\. That meets the route's 6\.0\.$/);
    expect(bandResultLine(issued(55)).key).toBe(ISSUED_BAND_SHORT);
  });

  test("[world:month-end-results-sheet] given the graduate's careful life, when its result is told by the engine, then it reaches 6.0 and its line says it meets the route's band", () => {
    const game = recordedGame("graduate-careful");
    expect(game.view().documents.find((paper) => paper.id === PAPER)?.value).toBeGreaterThanOrEqual(bandNeeded());
    // The tidy lines that reach the results say a band that reaches the route's meets it.
    expect(tidyLines([issued(60)]).map((line) => bandResultLine(line).key)).toEqual([ISSUED_BAND_MET]);
  });
});
