// Status abroad: docs/rules/status.md. Stub: none held.
import type { RegisteredKind } from "../engine/kind";
import { effectsNotBuilt, requirementsNotBuilt } from "../engine/stub";
import type { StatusSlice } from "../engine/types";
import type { StatusEvent } from "./status.events";

export const statusKind: RegisteredKind<StatusSlice, StatusEvent> = {
  kind: "status",
  initial: () => ({ current: null, removals: [] }),
  effects: effectsNotBuilt(["status/grant", "status/lose", "status/remove", "status/clock-start"]),
  evolve: (slice) => slice,
  requirements: requirementsNotBuilt(["status/is", "status/clock-under"]),
  view: () => ({ status: null }),
};
