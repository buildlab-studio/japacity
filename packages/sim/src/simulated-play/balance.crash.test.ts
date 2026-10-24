// The balance targets in a crash (scenario:economy-meets-its-targets, decision 0035): the Gulf from the shop and the racks and
// the nurse's route by month 36 in the crash world, and the naira pay review read in the golden world and the crash world.
import { content, presetAnswer } from "@japacity/content";
import { expect, test } from "vitest";

import type { PresetAnswer } from "./balance.testing";
import { CRASH_WORLD, crashPlays, GOLDEN_WORLD, MEASURES_BY_WORLD, measuresOf, reviewRead } from "./balance.testing";

/** The front door plays a preset from the archetype's youngest age card. */
const preset: PresetAnswer = (archetype, home, step, answers) => presetAnswer(archetype, 0, home, step, answers);

/** Long enough for every life on a loaded machine. */
const TIMEOUT = 600000;

test(
  "[scenario:economy-meets-its-targets] given the shop, the racks and the nurse trade-loyal on 20 seeds in the crash world, and a formal job reviewed for 36 months in the golden and crash worlds, when the crash is read, then it holds its threshold",
  () => {
    const review = { [GOLDEN_WORLD]: reviewRead(content, GOLDEN_WORLD), [CRASH_WORLD]: reviewRead(content, CRASH_WORLD) };
    const read = measuresOf(crashPlays(content, preset), review, MEASURES_BY_WORLD.crash);
    expect(read).toHaveLength(MEASURES_BY_WORLD.crash.length);
    for (const measure of read) expect.soft(measure.pass, `${measure.name}: ${measure.figures}`).toBe(true);
  },
  TIMEOUT,
);
