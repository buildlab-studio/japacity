// Why the airport's gate will not board yet, said before the tap (route/depart): held funds still open, or Canada's funds short on
// the day (route-gates:canada-funds-checked-at-departure).
import type { PlayerView, RouteGateView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame } from "../../../shared/testing/fixtures";
import { formatMoney } from "../../../shared/words/format";
import { say } from "../../../shared/words/text";
import { gateShut } from "./shut";

const CANADA = "route.canada-points";
type PointsGate = Extract<RouteGateView, { gate: "points" }>;

/** A view with Canada's points route granted and this gate. */
function granted(gate: Partial<PointsGate>): PlayerView {
  const base = newGame("scenario.teacher").view();
  const route = base.routes.find((entry) => entry.id === CANADA);
  if (route === undefined) throw new Error("No Canadian route.");
  const full: PointsGate = { gate: "points", points: 480, cutoff: 470, careCutoff: 475, educationCutoff: null, fundsShort: 0, invites: true, poolMonth: 10, profileEndsMonth: 22, invitedMonth: 12, ...gate };
  return { ...base, routes: [{ ...route, state: "granted", percent: 100, gate: full }] };
}

describe("the gate shut before the flight", () => {
  test("[route-gates:canada-funds-checked-at-departure] given Canada granted and the funds shown short on the day, when the gate is reached, then it says the flight waits for the money and by how much in Canadian dollars", () => {
    expect(gateShut(granted({ fundsShort: 120_000 }), CANADA)).toBe(say("ui.world.depart-funds", { amount: formatMoney(120_000, "CAD") }));
  });

  test("[route-gates:canada-funds-checked-at-departure] given the funds covered, when the gate is reached, then nothing shuts it", () => {
    expect(gateShut(granted({ fundsShort: 0 }), CANADA)).toBeNull();
  });
});
