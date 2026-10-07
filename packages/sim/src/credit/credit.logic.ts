// The credit file: docs/rules/credit.md. Stub: no file anywhere.
import type { RegisteredKind } from "../engine/kind";
import { effectsNotBuilt, requirementsNotBuilt } from "../engine/stub";
import type { CreditSlice } from "../engine/types";
import type { CreditEvent } from "./credit.events";

export const creditKind: RegisteredKind<CreditSlice, CreditEvent> = {
  kind: "credit",
  initial: () => ({ byCountry: {} }),
  effects: effectsNotBuilt(["credit/mark", "credit/judgment"]),
  evolve: (slice) => slice,
  requirements: requirementsNotBuilt(["credit/min"]),
  view: () => ({ credit: null }),
};
