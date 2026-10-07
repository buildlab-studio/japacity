// Qualities: docs/rules/quality.md. Stub: initial and view are real.
import type { RegisteredKind } from "../engine/kind";
import { effectsNotBuilt, requirementsNotBuilt } from "../engine/stub";
import type { Id, QualitySlice } from "../engine/types";
import type { QualityEvent } from "./quality.events";

export const qualityKind: RegisteredKind<QualitySlice, QualityEvent> = {
  kind: "quality",
  // Every quality in content, at the scenario's value or else the bottom of its range.
  initial(scenario, content) {
    const slice: QualitySlice = {};
    for (const entry of Object.values(content.quality)) slice[entry.id] = scenario.qualities[entry.id] ?? entry.min;
    return slice;
  },
  effects: effectsNotBuilt(["quality/add"]),
  evolve: (slice) => slice,
  requirements: requirementsNotBuilt(["quality/min", "quality/max"]),
  invariants(state, content) {
    const problems: string[] = [];
    for (const [id, value] of Object.entries(state.quality)) {
      const entry = content.quality[id as Id<"quality">];
      if (entry === undefined) problems.push(`The state holds ${id}, which is not a quality in content.`);
      else if (value < entry.min || value > entry.max) {
        problems.push(`${id} is ${String(value)}, outside ${String(entry.min)} to ${String(entry.max)}.`);
      }
    }
    return problems;
  },
  view: ({ state, content }) => ({
    qualities: Object.values(content.quality)
      .filter((entry) => entry.shown)
      .map((entry) => ({ id: entry.id, value: state.quality[entry.id] ?? entry.min })),
  }),
};
