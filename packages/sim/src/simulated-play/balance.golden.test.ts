// The balance targets in the golden world (scenario:economy-meets-its-targets, decision 0035): the developer rung, the mix of
// routes, the students, tech's pace and the money, over every style on every life for 96 months on 20 seeds, with the luck of a
// real ban in it. Each measure is its own expectation, so a failure names the measure and its figures.
import { content, presetAnswer } from "@japacity/content";
import { expect, test } from "vitest";

import type { PresetAnswer } from "./balance.testing";
import { BALANCE_STYLES, GOLDEN_WORLD, MEASURES_BY_WORLD, measuresOf, stylePlays } from "./balance.testing";

/** The front door plays a preset from the archetype's youngest age card. */
const preset: PresetAnswer = (archetype, home, step, answers) => presetAnswer(archetype, 0, home, step, answers);

/** Long enough for every life on a loaded machine. */
const TIMEOUT = 3600000;

test(
  "[scenario:economy-meets-its-targets] given every fixed life and each archetype's life under every style for 96 months on 20 seeds in the golden world, when the developer rung, the mix, the students, tech's pace and the money are read, then each holds its threshold",
  () => {
    const runs = BALANCE_STYLES.flatMap((style) => stylePlays(content, preset, style, GOLDEN_WORLD));
    const read = measuresOf(runs, {}, MEASURES_BY_WORLD.golden);
    expect(read).toHaveLength(MEASURES_BY_WORLD.golden.length);
    for (const measure of read) expect.soft(measure.pass, `${measure.name}: ${measure.figures}`).toBe(true);
  },
  TIMEOUT,
);
