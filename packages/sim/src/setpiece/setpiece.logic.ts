// Set pieces: docs/rules/route.md, R-SETPIECE-001 to 005. Stub: nothing is open.
import type { RegisteredKind } from "../engine/kind";
import type { SetpieceSlice } from "../engine/types";
import type { SetpieceEvent } from "./setpiece.events";

export const setpieceKind: RegisteredKind<SetpieceSlice, SetpieceEvent> = {
  kind: "setpiece",
  initial: () => ({ open: null }),
  evolve: (slice) => slice,
  view: ({ state }) => ({
    setpiece:
      state.setpiece.open === null
        ? null
        : {
            entry: state.setpiece.open.entry,
            asked: Object.keys(state.setpiece.open.answers).length,
            total: state.setpiece.open.questions.length,
            question: null,
          },
  }),
};
