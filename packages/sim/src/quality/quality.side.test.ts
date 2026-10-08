import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Id } from "../engine/types";
import { applyEffects } from "../route/route.journey";
import { start } from "../testing/play";
import { appliedAmount } from "./quality.logic";

const TECH: Id<"quality"> = "quality.tech";

describe("gains beside a side job", () => {
  test("[R-ACTIVITY-010] given a side job held, when a skill gains, then the gain is halved rounding up, and a quality that is not a skill is not", () => {
    const game = start({ content, scenario: "scenario.zainab" });
    const before = game.state.quality[TECH] ?? 0;
    applyEffects(game, [{ type: "quality/add", quality: TECH, amount: 4 }]);
    expect((game.state.quality[TECH] ?? 0) - before).toBe(4);
    game.state = { ...game.state, activity: { ...game.state.activity, side: "activity.weekend-tutoring" } };
    const held = game.state.quality[TECH] ?? 0;
    applyEffects(game, [{ type: "quality/add", quality: TECH, amount: 4 }]);
    expect((game.state.quality[TECH] ?? 0) - held).toBe(2);
    applyEffects(game, [{ type: "quality/add", quality: TECH, amount: 1 }]);
    expect((game.state.quality[TECH] ?? 0) - held).toBe(3);
    const wellbeing = game.state.quality["quality.wellbeing"] ?? 0;
    applyEffects(game, [{ type: "quality/add", quality: "quality.wellbeing", amount: -4 }]);
    expect((game.state.quality["quality.wellbeing"] ?? 0) - wellbeing).toBe(-4);
    const tech = content.quality[TECH]!;
    expect(appliedAmount(tech, 10, 5, content.tuning.quality, true)).toBe(3);
    expect(appliedAmount(tech, 10, 5, content.tuning.quality, false)).toBe(5);
  });

  test("[R-ACTIVITY-010] [R-ENGINE-017] given the side job's share of a skill gain moved in the tuning, when a skill gains, then the share is the tuning's, rounding up", () => {
    const tech = content.quality[TECH]!;
    const numbers = content.tuning.quality;
    expect(numbers.sideJobSkillBp).toBe(5000);
    expect(appliedAmount(tech, 10, 5, { ...numbers, sideJobSkillBp: 10000 }, true)).toBe(5);
    expect(appliedAmount(tech, 10, 5, { ...numbers, sideJobSkillBp: 2500 }, true)).toBe(2);
  });
});
