// The people around the character: docs/rules/people.md. Not built yet beyond
// the slice, the stub commands and the view: the people milestone's agents fill
// the commands, the phases, the lines and the requirements.
import type { RegisteredKind } from "../engine/kind";
import { reject } from "../engine/reject";
import type { PeopleSlice, PlayerView, ReadCtx, ReportLine, RequirementResult, State } from "../engine/types";
import type { PeopleEvent } from "./people.events";

function evolve(slice: PeopleSlice, event: PeopleEvent): PeopleSlice {
  switch (event.type) {
    case "people/invited":
    case "people/linked":
    case "people/courted":
    case "people/moment-added":
    case "people/moments-synced":
    case "people/proposed":
    case "people/proposal-received":
    case "people/answered":
    case "people/agreed":
    case "people/declined":
    case "people/withdrawn":
    case "people/consented":
    case "people/ended":
    case "people/facts-updated":
    case "people/gossip-heard":
    case "people/stand-in-changed":
    case "people/request-shared":
      return slice;
    default: {
      const never: never = event;
      throw new Error(`Unknown people event ${JSON.stringify(never)}.`);
    }
  }
}

function lines(): ReportLine[] {
  return [];
}

const notBuilt = (): RequirementResult => ({ met: false });

function view(read: ReadCtx): Pick<PlayerView, "people"> {
  const { slots, sponsoring } = read.state.people;
  return {
    people: {
      slots: Object.fromEntries(Object.entries(slots).map(([key, slot]) => [key, { state: slot.state, label: null, bond: slot.bond, invite: slot.invite }])),
      bonds: [],
      candidates: [],
      joint: null,
      sponsoring,
      barUntilMonth: null,
    },
  };
}

function invariants(state: State): string[] {
  const problems: string[] = [];
  if (!Number.isSafeInteger(state.people.assistanceTaken) || state.people.assistanceTaken < 0) problems.push("The people slice counts negative assistance.");
  return problems;
}

const rejectNotBuilt = () => reject("not-legal", "People are not built yet.");

export const peopleKind: RegisteredKind<PeopleSlice, PeopleEvent> = {
  kind: "people",
  initial: () => ({ slots: { partner: { state: "empty", bond: null, person: null, invite: null } }, bonds: {}, joint: null, sponsoring: null, arrived: null, assistanceTaken: 0, secret: { computerAnswers: null } }),
  commands: {
    "people/invite": rejectNotBuilt,
    "people/court": rejectNotBuilt,
    "people/propose": rejectNotBuilt,
    "people/answer": rejectNotBuilt,
    "people/withdraw": rejectNotBuilt,
    "people/consent": rejectNotBuilt,
    "people/end": rejectNotBuilt,
    "people/link": rejectNotBuilt,
    "people/facts": rejectNotBuilt,
    "people/moments": rejectNotBuilt,
    "people/proposal": rejectNotBuilt,
    "people/agreed": rejectNotBuilt,
    "people/ended": rejectNotBuilt,
    "people/gossip": rejectNotBuilt,
    "people/stand-in": rejectNotBuilt,
    "people/family-request": rejectNotBuilt,
  },
  effects: { "people/moment": () => [] },
  evolve,
  lines,
  requirements: { "people/bond": notBuilt, "people/sibling-abroad": notBuilt, "people/joint": notBuilt },
  invariants,
  view,
};
