// The balance targets in the calm world (scenario:economy-meets-its-targets, decision 0035): the trade-loyal lives against each
// trade's cheap band, and the pivots against them, on 20 seeds to the first flight. Each measure is its own expectation, so a
// failure names the measure and its figures.
import { content, presetAnswer } from "@japacity/content";
import { expect, test } from "vitest";

import type { PresetAnswer } from "./balance.testing";
import { CALM_STYLES, CALM_WORLD, MEASURES_BY_WORLD, measuresOf, stylePlays } from "./balance.testing";

/** The front door plays a preset from the archetype's youngest age card. */
const preset: PresetAnswer = (archetype, home, step, answers) => presetAnswer(archetype, 0, home, step, answers);

/** Long enough for every life on a loaded machine. */
const TIMEOUT = 3600000;

test(
  "[scenario:economy-meets-its-targets] given every fixed life and each archetype's life, trade-loyal and pivoting, for 96 months on 20 seeds in the calm world, when the bands and the pivot's pace are read, then each holds its threshold",
  () => {
    const runs = CALM_STYLES.flatMap((style) => stylePlays(content, preset, style, CALM_WORLD));
    const read = measuresOf(runs, {}, MEASURES_BY_WORLD.calm);
    expect(read).toHaveLength(MEASURES_BY_WORLD.calm.length);
    for (const measure of read) expect.soft(measure.pass, `${measure.name}: ${measure.figures}`).toBe(true);
  },
  TIMEOUT,
);
