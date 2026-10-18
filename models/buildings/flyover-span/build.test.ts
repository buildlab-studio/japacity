import { Box3 } from "three";
import { describe, expect, test } from "vitest";

import outline from "./outline.json";
import { buildFlyoverSpan, FLYOVER } from "./build";

const plan = outline.views.find((view) => view.view === "plan");
if (plan === undefined) throw new Error("The flyover has no plan outline");
const xs = plan.polygon.map(([x]) => x ?? 0);
const zs = plan.polygon.map(([, z]) => z ?? 0);

describe("the Ojuelegba flyover's span", () => {
  test("[assets:plan-outline-from-map-data] given the plan outline from OpenStreetMap, when the span is built, then its length is the outline's and its deck the outline's width, and the outline names the map data it came from", () => {
    const box = new Box3().setFromObject(buildFlyoverSpan());
    // Paint on a face sits a few millimetres proud of it, so sizes are read to the nearest 5 cm.
    expect(box.max.x - box.min.x).toBeCloseTo(Math.max(...xs) - Math.min(...xs), 1);
    expect(box.max.z - box.min.z).toBeCloseTo(Math.max(...zs) - Math.min(...zs), 1);
    expect(Math.max(...zs) - Math.min(...zs)).toBe(FLYOVER.deckWidth);
    expect(plan.source).toMatch(/^https:\/\/www\.openstreetmap\.org\/way\/\d+/);
    expect(plan.source).toContain(`${String(FLYOVER.rowGap)} m over the junction`);
  });

  test("[assets:metre-units-and-origin] given the span, when it is built, then it stands on y = 0, its deck about 5 m clear over the street, and it is no taller than a building may be", () => {
    const box = new Box3().setFromObject(buildFlyoverSpan());
    expect(Math.abs(box.min.y)).toBeLessThanOrEqual(0.01);
    expect(box.max.y).toBeLessThanOrEqual(13);
    expect(FLYOVER.soffit).toBeGreaterThanOrEqual(5);
    expect(FLYOVER.top).toBeGreaterThan(FLYOVER.soffit);
  });
});
