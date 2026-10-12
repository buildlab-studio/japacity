// The sky and the sun by the world's clock (docs/rules/clock.md R-CLOCK-033, decision 0036): the place's one sun and one
// sky light turned and tinted by the part of the world's day and the minute within it; the development switch that pins it.
import { time, worldClockAt } from "@japacity/sim";
import { Color } from "three";
import { describe, expect, test } from "vitest";

import parlourRaw from "../../../public/assets/places/family-house-parlour/place.json";
import { LOOKS, lookAt, ownHeightOf, pinnedClock, pinnedPart, progressIn, skyOf, sunAt, worldNow } from "./daylight";
import { type PlaceFile, stageOf } from "./placeFile";

const SUN = stageOf(parlourRaw as unknown as PlaceFile).light.sun;
const HOUR = 60;
const lum = (hex: number): number => {
  const colour = new Color(hex);
  return 0.2126 * colour.r + 0.7152 * colour.g + 0.0722 * colour.b;
};
const warmth = (hex: number): number => {
  const colour = new Color(hex);
  return colour.r - colour.b;
};
const flatAngle = ([x, , z]: readonly number[]): number => Math.atan2(z ?? 0, x ?? 0);

describe("the sky and the sun by the world's clock", () => {
  test("[R-CLOCK-033] given the afternoon's start, when the place is lit, then it is lit as it always was: its own sun where the file puts it, a white light, its own sky", () => {
    const look = lookAt("afternoon", 12 * HOUR, SUN);
    const at = sunAt(SUN, look);
    at.forEach((value, index) => expect(value).toBeCloseTo(SUN[index] ?? 0, 6));
    expect(look.sun).toBe(0xfff0d0);
    expect(look.sunStrength).toBe(2);
    expect(look.tintShare).toBe(0);
    expect(look.lamps).toBe(0);
  });

  test("[R-CLOCK-033] given the morning, when the place is lit, then the sun is low and warm with long soft shadows, the sky pale, and it climbs toward the day's light by noon", () => {
    const early = lookAt("morning", 6 * HOUR + 30, SUN);
    const late = lookAt("morning", 11 * HOUR + 50, SUN);
    const noon = lookAt("afternoon", 12 * HOUR, SUN);
    expect(early.height ?? 90).toBeLessThan(25);
    expect(early.height ?? 0).toBeLessThan(late.height ?? 0);
    expect(warmth(early.sun)).toBeGreaterThan(warmth(noon.sun));
    expect(early.softness).toBeGreaterThan(noon.softness);
    expect(early.tintShare).toBeGreaterThan(0);
    // Pale: the morning's sky is lighter than the place's own warm sky, never darker.
    expect(lum(skyOf(new Color(0xf3d9a4), early).getHex())).toBeGreaterThanOrEqual(lum(0xf3d9a4));
  });

  test("[R-CLOCK-033] given the evening, when the place is lit, then the sun is orange and low on the other side from the morning's, the sky warms, and by its end the lamps are on", () => {
    const morning = lookAt("morning", 7 * HOUR, SUN);
    const evening = lookAt("evening", 18 * HOUR + 30, SUN);
    const dusk = lookAt("evening", 21 * HOUR + 55, SUN);
    expect(evening.height ?? 90).toBeLessThan(20);
    expect(warmth(evening.sun)).toBeGreaterThan(warmth(morning.sun));
    // The other side: the morning's and the evening's suns stand more than a right angle apart round the place.
    const apart = Math.abs(Math.atan2(Math.sin(flatAngle(sunAt(SUN, morning)) - flatAngle(sunAt(SUN, evening))), Math.cos(flatAngle(sunAt(SUN, morning)) - flatAngle(sunAt(SUN, evening)))));
    expect(apart).toBeGreaterThan(Math.PI / 2);
    expect(warmth(evening.tint)).toBeGreaterThan(0);
    expect(dusk.lamps).toBeGreaterThan(evening.lamps);
    expect(dusk.lamps).toBeCloseTo(1, 1);
  });

  test("[R-CLOCK-033] given the night, when the place is lit, then the sky is deep blue, the sun almost out, the sky light low, and the lamps full; toward six it pales into the morning", () => {
    const night = lookAt("night", 0, SUN);
    const noon = lookAt("afternoon", 14 * HOUR, SUN);
    const sky = skyOf(new Color(0xf3d9a4), night);
    expect(sky.b).toBeGreaterThan(sky.r);
    expect(lum(sky.getHex())).toBeLessThan(0.15);
    expect(night.sunStrength).toBeLessThan(noon.sunStrength / 4);
    expect(night.skyStrength).toBeLessThan(noon.skyStrength);
    expect(night.lamps).toBe(1);
    const late = lookAt("night", 5 * HOUR + 59, SUN);
    expect(late.sun).not.toBe(night.sun);
    expect(Math.abs(late.sunStrength - LOOKS.morning.from.sunStrength)).toBeLessThan(0.1);
    expect(lookAt("night", 4 * HOUR, SUN)).toEqual(night);
  });

  test("[R-CLOCK-033] given a minute of the day, when its share of its part is read, then each part runs from its start to its end, the night across midnight", () => {
    expect(progressIn("morning", 6 * HOUR)).toBe(0);
    expect(progressIn("morning", 9 * HOUR)).toBe(0.5);
    expect(progressIn("evening", 20 * HOUR)).toBe(0.5);
    expect(progressIn("night", 22 * HOUR)).toBe(0);
    expect(progressIn("night", 2 * HOUR)).toBe(0.5);
    expect(ownHeightOf([0, 1, 1])).toBeCloseTo(45, 6);
  });

  test("[R-CLOCK-033] given the device and a reply, when the clock is read between replies, then the reply's reading wins and the device carries it on; with no reply the device's own", () => {
    const at = time.GAME_DAY_EPOCH_MS + 3 * time.GAME_DAY_MS;
    expect(worldNow(at, null)).toEqual(worldClockAt(at));
    // The server's clock stood an hour of the game ahead of the device's when its reply came.
    const ahead = worldClockAt(at + time.GAME_DAY_MS / 24);
    const later = at + 60_000;
    expect(worldNow(later, { world: ahead, at }).minute).toBe(worldClockAt(later + time.GAME_DAY_MS / 24).minute);
  });

  test("[R-CLOCK-033] given the development switch, when ?clock= names a part, then the scene's clock stands at it; outside development, or with any other word, it does not", () => {
    expect(pinnedPart("?clock=night", true)).toBe("night");
    expect(pinnedPart("?a=1&clock=morning", true)).toBe("morning");
    expect(pinnedPart("?clock=night", false)).toBeNull();
    expect(pinnedPart("?clock=noon", true)).toBeNull();
    expect(pinnedPart("", true)).toBeNull();
    for (const part of ["morning", "afternoon", "evening", "night"] as const) {
      const clock = pinnedClock(part);
      expect(clock.part).toBe(part);
      expect(worldClockAt(time.GAME_DAY_EPOCH_MS + (clock.minute * time.GAME_DAY_MS) / 1440).part).toBe(part);
    }
  });
});
