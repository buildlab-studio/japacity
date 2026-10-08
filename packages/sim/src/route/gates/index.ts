// One module for each gate the contract names (R-GATE-001).
import type { RouteGate } from "../../engine/types";
import { contractGate } from "./contract";
import { endorsementGate } from "./endorsement";
import type { Gate } from "./gate";
import { pointsGate } from "./points";
import { roadGate } from "./road";
import { sponsorGate } from "./sponsor";
import { studyGate } from "./study";

export const GATES: Record<RouteGate, Gate> = {
  study: studyGate,
  sponsor: sponsorGate,
  points: pointsGate,
  endorsement: endorsementGate,
  contract: contractGate,
  road: roadGate,
};

export type { Decision, DecisionTerms, Gate, GateEffectHandler } from "./gate";
export { EVERY_TERM, NO_TERM } from "./gate";
