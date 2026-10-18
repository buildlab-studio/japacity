// The arrivals hall at the Lagos airport: the gate that boards the plane reads Departures (docs/rules/world.md
// R-WORLD-005).
import { describe, expect, test } from "vitest";

import raw from "../../../../public/assets/places/arrivals-hall/place.json";
import { say } from "../../../shared/words/text";
import { staged } from "./place.testing";
import { cityWords } from "../city.words";

const { stage } = staged(raw, "place.airport-lagos");

describe("the airport's gate", () => {
  test("[R-WORLD-005] given the gate that boards the plane, when its label and first act are read, then it reads Departures with Board the plane, never Arrivals", () => {
    const gate = (stage.things ?? []).find((thing) => thing.id === "gate");
    expect(cityWords(gate?.label ?? "")).toBe("Departures");
    expect(gate?.acts[0]).toMatchObject({ kind: "command", command: "route/depart" });
    expect(cityWords(gate?.acts[0]?.label ?? "")).toBe(say("ui.route.depart"));
    expect(cityWords(gate?.acts[0]?.label ?? "")).toBe("Board the plane");
  });
});
