// Documents: docs/rules/document.md. Stub: the scenario's papers are real.
import type { RegisteredKind } from "../engine/kind";
import { effectsNotBuilt, requirementsNotBuilt } from "../engine/stub";
import type { DocumentSlice, Id } from "../engine/types";
import type { DocumentEvent } from "./document.events";

export const documentKind: RegisteredKind<DocumentSlice, DocumentEvent> = {
  kind: "document",
  initial(scenario) {
    const slice: DocumentSlice = {};
    for (const held of scenario.documents) {
      slice[held.document] = { state: "held", readyMonth: 0, expiresMonth: held.monthsLeft, value: held.value };
    }
    return slice;
  },
  effects: effectsNotBuilt(["document/request", "document/grant", "document/void"]),
  evolve: (slice) => slice,
  requirements: requirementsNotBuilt(["document/held", "document/absent", "document/pending"]),
  invariants(state, content) {
    return Object.keys(state.document)
      .filter((id) => content.document[id as Id<"document">] === undefined)
      .map((id) => `The state holds ${id}, which is not a document in content.`);
  },
  view: ({ state }) => ({
    documents: Object.entries(state.document).map(([id, held]) => ({
      id: id as Id<"document">,
      state: held.state,
      readyMonth: held.readyMonth,
      expiresMonth: held.expiresMonth,
      value: held.value,
    })),
  }),
};
