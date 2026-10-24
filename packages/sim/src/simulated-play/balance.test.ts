// The balance targets (scenario:economy-meets-its-targets, docs/design/13-the-economy.md section 2): every fixed life and a life built from
// each archetype's preset, under every player style, for 96 months over 20 seeds in the golden world and in world-b, read into the ten
// measures. Each measure is its own expectation, so a failure names the measure and its figures. It plays about 1,600 lives and runs for
// several minutes.
import { content, presetAnswer } from "@japacity/content";
import { expect, test } from "vitest";

import type { PresetAnswer } from "./balance.testing";
import { balancePlays, CRASH_WORLD, GOLDEN_WORLD, measures, reviewRead } from "./balance.testing";

/** The front door plays a preset from the archetype's youngest age card. */
const preset: PresetAnswer = (archetype, home, step, answers) => presetAnswer(archetype, 0, home, step, answers);

/** Long enough for every life on a loaded machine. */
const TIMEOUT = 3600000;

test(
  "[scenario:economy-meets-its-targets] given every fixed life and each archetype's life under every style for 96 months on 20 seeds, in the golden world and world-b, when the ten measures are read, then each holds its threshold",
  () => {
    const runs = balancePlays(content, preset);
    const review = { [GOLDEN_WORLD]: reviewRead(content, GOLDEN_WORLD), [CRASH_WORLD]: reviewRead(content, CRASH_WORLD) };
    const read = measures(runs, review);
    expect(read).toHaveLength(10);
    for (const measure of read) expect.soft(measure.pass, `${measure.name}: ${measure.figures}`).toBe(true);
  },
  TIMEOUT,
);
