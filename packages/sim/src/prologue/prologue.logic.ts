// The prologue: docs/rules/prologue.md. Stub: closed for every fixed life; open
// for scenario.prologue, which no fixed content has yet.
import type { RegisteredKind } from "../engine/kind";
import type { PrologueSlice } from "../engine/types";
import type { PrologueEvent } from "./prologue.events";

export const prologueKind: RegisteredKind<PrologueSlice, PrologueEvent> = {
  kind: "prologue",
  initial: (scenario) => ({
    open: scenario.prologue === true,
    step: null,
    draw: null,
    choices: {},
    lastOutcome: null,
    flags: [],
    gradeBase: 0,
  }),
  evolve: (slice) => slice,
  view: ({ state }) =>
    state.prologue.open && state.prologue.step !== null
      ? { prologue: { step: state.prologue.step, answers: [], lastOutcome: state.prologue.lastOutcome, draw: state.prologue.draw } }
      : { prologue: null },
};
