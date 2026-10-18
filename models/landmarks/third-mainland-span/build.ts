// A section of the Third Mainland Bridge (city.md place.third-mainland-bridge), built as a
// repeating segment (assets:long-landmark-repeats-segment): 45 m bays of a haunched girder, deep over the piers and
// shallow at mid-span, so a side view is a line of flat arches; a 33 m deck flat at 8 m over
// the water, eight lanes with a median, two slender shafts and a crosshead at every pier, and
// one lamp post a span. Built to the review's measurements, never to a photograph.
import { setFootprint } from "@japacity/model-kit";
import { box, cylinder, extrude, floorQuad, quad, seeded } from "@japacity/model-kit/kit";
import { Group } from "three";

export const BRIDGE = {
  bays: 13,
  bay: 45,
  deckWidth: 33,
  top: 8.0,
  /** Girder depth at mid-span and the extra over each pier. */
  depthMid: 3.5,
  depthPier: 3.0,
  piecesPerBay: 16,
  lamp: 11,
} as const;

/** The girder's depth at t, from -1 at one pier through 0 at mid-span to 1 at the next: flat for most of the span, falling steeply near the piers. */
export function girderDepth(t: number): number {
  return BRIDGE.depthMid + BRIDGE.depthPier * t ** 4;
}

export function buildBridgeSpan(): Group {
  const g = new Group();
  g.name = "landmark_third-mainland-span";
  const random = seeded(1990);
  const { bays, bay, deckWidth, top, piecesPerBay } = BRIDGE;
  const length = bays * bay;
  const x0 = -length / 2;
  // The girder of each bay as one profile: the soffit follows the haunch, and the top stops 0.3 m
  // under the road so the two never fight for a pixel.
  for (let b = 0; b < bays; b++) {
    const profile: [number, number][] = [[0, top - 0.3]];
    for (let i = 0; i <= piecesPerBay; i++) {
      const t = -1 + (i / piecesPerBay) * 2;
      profile.push([((t + 1) / 2) * bay, top - girderDepth(t)]);
    }
    profile.push([bay, top - 0.3]);
    extrude(g, profile.reverse(), deckWidth - 3, random() < 0.25 ? "concreteWorn" : "concrete", x0 + b * bay, 0, 0);
  }
  // The deck: eight lanes of asphalt, lane lines, a median and two parapets.
  box(g, length, 0.3, deckWidth, 0, top - 0.3, 0, "asphalt");
  for (const s of [-1, 1]) {
    box(g, length, 1.0, 0.5, 0, top, s * (deckWidth / 2 - 0.25), "concrete");
    quad(g, length, 0.5, 0, top - 0.3, s * (deckWidth / 2 + 0.002), "concreteWorn");
    for (const lane of [1, 2, 3]) {
      for (let x = x0 + 2; x < -x0 - 4; x += 12) floorQuad(g, 4, 0.15, x + 2, top + 0.005, s * (1.75 + lane * 3.6), "marking");
    }
  }
  box(g, length, 0.8, 1.2, 0, top, 0, "concrete");
  // Patched road: darker squares where the asphalt was mended.
  for (let k = 0; k < 10; k++) floorQuad(g, 3 + random() * 5, 2 + random() * 2, x0 + random() * length, top + 0.004, (random() - 0.5) * (deckWidth - 6), "concreteWorn");
  // Piers: two shafts under every bay line and a crosshead, about 1.5 m showing above the water.
  for (let i = 0; i <= bays; i++) {
    const x = x0 + i * bay;
    for (const s of [-1, 1]) cylinder(g, 2.0, 2.6, x, 0, s * 9, "concreteWorn", 10);
    box(g, 4.0, 1.4, 24, x, 1.1, 0, "concrete");
  }
  // One lamp post a span, on the median, about 11 m above the deck, with arms over both carriageways.
  for (let b = 0; b < bays; b++) {
    const x = x0 + (b + 0.5) * bay;
    box(g, 0.3, BRIDGE.lamp, 0.3, x, top + 0.8, 0, "hub");
    box(g, 0.25, 0.25, 7, x, top + 0.8 + BRIDGE.lamp - 0.3, 0, "hub");
  }
  // The piers in the water, each its crosshead and two shafts; the deck passes far overhead.
  return setFootprint(g, Array.from({ length: bays + 1 }, (_, index) => ({ x: x0 + index * bay, z: 0, width: 4.4, depth: 24 })));
}
