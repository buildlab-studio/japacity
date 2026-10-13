// The fan's layout (docs/design/13-the-lively-layer.md section 3; docs/rules/world.md R-WORLD-005): the acts of a thing
// fanned out of the thing on a curve into the larger free side of the screen, up to six before the fold, the sheet when
// the free side cannot hold them. Pure: a point, a screen and a count in, places out.
import { describe, expect, test } from "vitest";

import { type FanLayout, fanLayout, fanSizes, LAPTOP, PHONE, placesAt, shiftRange } from "./fanLayout";

const PHONE_SCREEN = { width: 390, height: 844 };
const LAPTOP_SCREEN = { width: 1200, height: 800 };
/** The band over the top and the thumbs at the foot, as a phone's world shows them. */
const INSET = { top: 80, bottom: 108 };

function phone(at: { x: number; y: number }, count: number): FanLayout {
  return fanLayout({ at, screen: PHONE_SCREEN, count, inset: INSET, ...PHONE });
}

function laptop(at: { x: number; y: number }, count: number): FanLayout {
  return fanLayout({ at, screen: LAPTOP_SCREEN, count, inset: INSET, ...LAPTOP });
}

/** Each button's centre on the screen. */
function centres(layout: FanLayout, at: { x: number; y: number }): { x: number; y: number }[] {
  return layout.places.map((place) => ({ x: at.x + place.dx, y: at.y + place.dy }));
}

/** Two buttons or their label rows cover each other: closer than a pitch in height. */
function crowded(layout: FanLayout): boolean {
  return layout.places.some((place, index) => index > 0 && place.dy - (layout.places[index - 1]?.dy ?? 0) < layout.sizes.pitch - 0.5);
}

describe("the fan's side and its curve", () => {
  test("[R-WORLD-005] given the cooking corner low on the left of a phone, when its two meals fan out, then they open to the right, the larger free side, both before the fold, on the screen, labels inside the screen's edge", () => {
    const at = { x: 165, y: 586 };
    const layout = phone(at, 2);
    expect(layout.side).toBe("right");
    expect(layout.fits).toBe(true);
    expect(layout.shown).toBe(2);
    for (const centre of centres(layout, at)) {
      expect(centre.x).toBeGreaterThan(at.x);
      // The label sits outside the curve, to the right of the button, and stays on the screen.
      expect(centre.x + layout.sizes.button / 2 + layout.sizes.gap + layout.sizes.label).toBeLessThanOrEqual(PHONE_SCREEN.width);
      expect(centre.y - layout.sizes.button / 2).toBeGreaterThanOrEqual(INSET.top);
      expect(centre.y + layout.sizes.button / 2).toBeLessThanOrEqual(PHONE_SCREEN.height - INSET.bottom);
    }
    expect(crowded(layout)).toBe(false);
  });

  test("[R-WORLD-005] given a thing on the right of a phone, when its acts fan out, then they open to the left with their labels on the left of the buttons, and the side is the larger free one", () => {
    const at = { x: 300, y: 400 };
    const layout = phone(at, 3);
    expect(layout.side).toBe("left");
    expect(layout.fits).toBe(true);
    for (const centre of centres(layout, at)) {
      expect(centre.x).toBeLessThan(at.x);
      expect(centre.x - layout.sizes.button / 2 - layout.sizes.gap - layout.sizes.label).toBeGreaterThanOrEqual(0);
    }
  });

  test("[R-WORLD-005] given a thing in the middle of the screen's height, when four acts fan out, then they stand in order down a curve centred on the thing, the middle ones further out than the ends", () => {
    const at = { x: 60, y: 420 };
    const layout = phone(at, 4);
    const ys = layout.places.map((place) => place.dy);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    // Centred on the thing: as far above as below.
    expect(Math.abs((ys[0] ?? 0) + (ys[3] ?? 0))).toBeLessThan(1);
    const dx = layout.places.map((place) => place.dx);
    expect(dx[1]).toBeGreaterThan(dx[0] ?? 0);
    expect(dx[2]).toBeGreaterThan(dx[3] ?? 0);
    expect(crowded(layout)).toBe(false);
  });

  test("[R-WORLD-005] given a thing just under the band, when its acts fan out, then the curve sweeps down from it and no button stands under the band", () => {
    const at = { x: 40, y: 110 };
    const layout = phone(at, 3);
    expect(layout.fits).toBe(true);
    for (const centre of centres(layout, at)) expect(centre.y - layout.sizes.button / 2).toBeGreaterThanOrEqual(INSET.top);
    expect(layout.places.every((place) => place.dy >= -layout.sizes.button)).toBe(true);
  });

  test("[R-WORLD-005] given a laptop, when the cooking corner's acts fan out, then the buttons are larger, the curve wider and the labels wider, all on the screen", () => {
    const at = { x: 420, y: 380 };
    const small = phone({ x: 120, y: 380 }, 3);
    const large = laptop(at, 3);
    expect(large.sizes.button).toBeGreaterThan(small.sizes.button);
    expect(large.rx).toBeGreaterThan(small.rx);
    expect(large.side).toBe("right");
    for (const centre of centres(large, at)) expect(centre.x + large.sizes.button / 2 + large.sizes.gap + large.sizes.label).toBeLessThanOrEqual(LAPTOP_SCREEN.width);
  });

});

// The fan's own rule, R-WORLD-034, is to be written into docs/rules/world.md; until it stands there these tests cite
// R-WORLD-005, whose amendment of 12 Oct 2026 the fan replaces, and the rule id rides in the describe's name.
describe("R-WORLD-034 the fan's sizes", () => {
  test("[R-WORLD-005] given the screen's width, when the sizes are read, then a phone gets 64 pixel buttons on a 170 radius and a laptop 72 on a 200 radius (the hand's wave)", () => {
    expect(fanSizes(390)).toEqual(PHONE);
    expect(fanSizes(1200)).toEqual(LAPTOP);
    expect(PHONE.radius).toBe(170);
    expect(PHONE.button).toBe(64);
    expect(LAPTOP.radius).toBe(200);
    expect(LAPTOP.button).toBe(72);
  });
});

describe("the fold and the sheet", () => {
  test("[R-WORLD-005] given seven acts on a phone, when they fan out, then six stand before the fold and the seventh peeks below it, closer to the foot of the screen than the last of the six", () => {
    const at = { x: 50, y: 400 };
    const layout = phone(at, 7);
    expect(layout.fits).toBe(true);
    expect(layout.shown).toBe(6);
    const sixth = layout.places[5];
    const seventh = layout.places[6];
    if (sixth === undefined || seventh === undefined) throw new Error("Seven places expected.");
    expect(at.y + sixth.dy + layout.sizes.button / 2).toBeLessThanOrEqual(PHONE_SCREEN.height - INSET.bottom);
    expect(at.y + seventh.dy - layout.sizes.button / 2).toBeLessThan(PHONE_SCREEN.height);
    expect(at.y + seventh.dy + layout.sizes.button / 2).toBeGreaterThan(PHONE_SCREEN.height - INSET.bottom);
    expect(seventh.folded).toBe(true);
    expect(sixth.folded).toBe(false);
  });

  test("[R-WORLD-005] given seven acts, when the fan is dragged along its curve, then each moves up by the drag and stays on the curve, and the drag stops once the last has come above the fold", () => {
    const at = { x: 50, y: 400 };
    const layout = phone(at, 7);
    const range = shiftRange(layout);
    expect(range.max).toBe(0);
    expect(range.min).toBe(-layout.sizes.pitch);
    const moved = placesAt(layout, -layout.sizes.pitch);
    expect(moved[1]?.dy).toBeCloseTo(layout.places[0]?.dy ?? 0, 5);
    expect(moved[6]?.folded).toBe(false);
    expect(moved[0]?.folded).toBe(true);
    // On the curve: a place at the same height is as far out wherever it came from.
    expect(moved[1]?.dx).toBeCloseTo(layout.places[0]?.dx ?? 0, 5);
    // Past the range, the drag holds at its end.
    expect(placesAt(layout, -10_000)[6]?.dy).toBeCloseTo(moved[6]?.dy ?? 0, 5);
  });

  test("[R-WORLD-005] given a thing in the very middle of a phone, when its acts would fan out, then neither side can hold the labels and the fan does not fit, so the sheet opens", () => {
    const layout = phone({ x: 195, y: 420 }, 2);
    expect(layout.fits).toBe(false);
  });

  test("[R-WORLD-005] given a short screen that cannot hold three buttons, when five acts would fan out, then the fan does not fit; with two acts it holds both", () => {
    const short = { width: 390, height: 360 };
    expect(fanLayout({ at: { x: 40, y: 180 }, screen: short, count: 5, inset: INSET, ...PHONE }).fits).toBe(false);
    expect(fanLayout({ at: { x: 40, y: 180 }, screen: short, count: 2, inset: INSET, ...PHONE }).fits).toBe(true);
  });

  test("[R-WORLD-005] given a thing off the screen, when its acts would fan out, then the fan does not fit", () => {
    expect(phone({ x: -20, y: 400 }, 2).fits).toBe(false);
    expect(phone({ x: 100, y: 900 }, 2).fits).toBe(false);
  });

  test("[R-WORLD-005] given any spot on a phone or a laptop and one to seven acts, when the fan fits, then no two buttons crowd each other and every button before the fold is inside the band and the thumbs", () => {
    for (const [screen, sizes] of [[PHONE_SCREEN, PHONE], [LAPTOP_SCREEN, LAPTOP]] as const) {
      for (let x = 10; x < screen.width; x += 37) {
        for (let y = 90; y < screen.height - 100; y += 53) {
          for (let count = 1; count <= 7; count += 1) {
            const layout = fanLayout({ at: { x, y }, screen, count, inset: INSET, ...sizes });
            if (!layout.fits) continue;
            expect(crowded(layout)).toBe(false);
            layout.places.slice(0, layout.shown).forEach((place) => {
              expect(y + place.dy - sizes.button / 2).toBeGreaterThanOrEqual(INSET.top - 0.5);
              expect(y + place.dy + sizes.button / 2).toBeLessThanOrEqual(screen.height - INSET.bottom + 0.5);
              const outer = layout.side === "right" ? x + place.dx + sizes.button / 2 + sizes.gap + sizes.label : x + place.dx - sizes.button / 2 - sizes.gap - sizes.label;
              expect(outer).toBeGreaterThanOrEqual(-0.5);
              expect(outer).toBeLessThanOrEqual(screen.width + 0.5);
            });
          }
        }
      }
    }
  });
});
