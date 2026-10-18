// One module for each gate the contract names (route-gates:route-runs-its-gate-steps).
import type { RouteGate } from "../../engine/types";
import { contractGate } from "./contract";
import { endorsementGate } from "./endorsement";
import type { Gate } from "./gate";
import { pointsGate } from "./points";
import { roadGate } from "./road";
import { sponsorGate } from "./sponsor";
import { studyGate } from "./study";
import { dependantGate } from "./dependant";
import { partnerGate } from "./partner";

export const GATES: Record<RouteGate, Gate> = {
  study: studyGate,
  sponsor: sponsorGate,
  points: pointsGate,
  endorsement: endorsementGate,
  contract: contractGate,
  road: roadGate,
  partner: partnerGate,
  dependant: dependantGate,
};

export type { ApplicationFigures, Decision, DecisionTerms, Gate, GateEffectHandler } from "./gate";
export { EVERY_TERM } from "./gate";
