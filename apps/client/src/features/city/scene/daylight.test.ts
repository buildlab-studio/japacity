// The sky and the sun by the world's clock (clock:game-day-on-real-time, decision 0011): the place's one sun and one
// sky light turned and tinted by the part of the world's day and the minute within it; the development switch that pins it.
import { time, worldClockAt } from "@japacity/sim";
import { Color } from "three";
import { describe, expect, test } from "vitest";

import parlourRaw from "../../../../public/assets/places/home-family-house/place.json";
import { lightKindOf, LOOKS, lookAt, ownHeightOf, PLACE_LIGHT, pinnedClock, pinnedPart, placeLook, progressIn, ROOM_LIGHT, roomLook, skyLightOf, skyOf, sunAt, worldNow } from "./daylight";
import { type PlaceFile, stageOf } from "../../../shared/scene/placeFile";

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
  test("[clock:game-day-on-real-time] given the afternoon's start, when the place is lit, then it is lit as it always was: its own sun where the file puts it, a white light, its own sky", () => {
    const look = lookAt("afternoon", 12 * HOUR, SUN);
    const at = sunAt(SUN, look);
    at.forEach((value, index) => expect(value).toBeCloseTo(SUN[index] ?? 0, 6));
    expect(look.sun).toBe(0xfff0d0);
    expect(look.sunStrength).toBe(2);
    expect(look.tintShare).toBe(0);
    expect(look.lamps).toBe(0);
  });

  test("[clock:game-day-on-real-time] given the morning, when the place is lit, then the sun is low and warm with long soft shadows, the sky pale, and it climbs toward the day's light by noon", () => {
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

  test("[clock:game-day-on-real-time] given the evening, when the place is lit, then the sun is orange and low on the other side from the morning's, the sky warms, and by its end the lamps are on", () => {
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

  test("[clock:game-day-on-real-time] given the night, when the place is lit, then the sky is deep blue, the sun almost out, the sky light low, and the lamps full; toward six it pales into the morning", () => {
    const night = lookAt("night", 0, SUN);
    const noon = lookAt("afternoon", 14 * HOUR, SUN);
    const sky = skyOf(new Color(0xf3d9a4), night);
    expect(sky.b).toBeGreaterThan(sky.r);
    expect(lum(sky.getHex())).toBeLessThan(0.15);
    expect(night.sunStrength).toBeLessThan(noon.sunStrength / 4);
    // The sky light's colour by its strength: far under the afternoon's.
    const own = new Color(0xf3d9a4);
    expect(lum(skyLightOf(own, night).getHex()) * night.skyStrength).toBeLessThan((lum(skyLightOf(own, noon).getHex()) * noon.skyStrength) / 2);
    expect(night.lamps).toBe(1);
    // The sky light is moonlit, still blue, so the room reads dark but seen.
    const moon = skyLightOf(new Color(0xf3d9a4), night);
    expect(moon.b).toBeGreaterThan(moon.r);
    expect(lum(moon.getHex())).toBeGreaterThan(lum(sky.getHex()));
    const late = lookAt("night", 5 * HOUR + 59, SUN);
    expect(late.sun).not.toBe(night.sun);
    expect(Math.abs(late.sunStrength - LOOKS.morning.from.sunStrength)).toBeLessThan(0.1);
    expect(lookAt("night", 4 * HOUR, SUN)).toEqual(night);
  });

  test("[clock:game-day-on-real-time] given a minute of the day, when its share of its part is read, then each part runs from its start to its end, the night across midnight", () => {
    expect(progressIn("morning", 6 * HOUR)).toBe(0);
    expect(progressIn("morning", 9 * HOUR)).toBe(0.5);
    expect(progressIn("evening", 20 * HOUR)).toBe(0.5);
    expect(progressIn("night", 22 * HOUR)).toBe(0);
    expect(progressIn("night", 2 * HOUR)).toBe(0.5);
    expect(ownHeightOf([0, 1, 1])).toBeCloseTo(45, 6);
  });

  test("[clock:game-day-on-real-time] given the device and a reply, when the clock is read between replies, then the reply's reading wins and the device carries it on; with no reply the device's own", () => {
    const at = time.GAME_DAY_EPOCH_MS + 3 * time.GAME_DAY_MS;
    expect(worldNow(at, null)).toEqual(worldClockAt(at));
    // The server's clock stood an hour of the game ahead of the device's when its reply came.
    const ahead = worldClockAt(at + time.GAME_DAY_MS / 24);
    const later = at + 60_000;
    expect(worldNow(later, { world: ahead, at }).minute).toBe(worldClockAt(later + time.GAME_DAY_MS / 24).minute);
  });

  test("[clock:game-day-on-real-time] given the development switch, when ?clock= names a part, then the scene's clock stands at it; outside development, or with any other word, it does not", () => {
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

describe("the rooms' light", () => {
  test("[clock:game-day-on-real-time] given a room by day, when its look is read, then its sun is warmed toward the room's own and both lights stand as strong as the room's are at noon; at night the look's lamps are untouched and the sun is the night's", () => {
    const noon = lookAt("afternoon", time.AFTERNOON_HOUR * HOUR, SUN);
    const room = roomLook(noon);
    expect(room.sunStrength).toBeCloseTo(ROOM_LIGHT.sunStrength, 6);
    expect(room.skyStrength).toBeCloseTo(ROOM_LIGHT.skyStrength, 6);
    expect(room.sun).not.toBe(noon.sun);
    const night = lookAt("night", 0, SUN);
    expect(roomLook(night).lamps).toBe(night.lamps);
    expect(roomLook(night).sun).toBe(night.sun);
    expect(roomLook(night).sunStrength).toBeLessThan(room.sunStrength);
  });

  test("[assets:lighting-set-by-place] given a street and an office, when their light is read, then both take the layer's pale, cool sky light and pale sky in place of the sand, the office a warm floor bounce at the rooms' strengths and the street its own ground with the fog fading into the pale sky", () => {
    for (const kind of ["street", "office"] as const) {
      const light = PLACE_LIGHT[kind];
      expect(light.sky).toBe(ROOM_LIGHT.sky);
      expect(light.backdrop).toBe(ROOM_LIGHT.backdrop);
      // Paler and cooler than a sand sky (0xf3d9a4): lighter, and its blue above its red.
      expect(lum(light.backdrop)).toBeGreaterThan(lum(0xf3d9a4));
      expect(warmth(light.sky)).toBeLessThan(0);
      expect(warmth(light.sun)).toBeGreaterThan(0);
    }
    expect(PLACE_LIGHT.office).toEqual({ ...PLACE_LIGHT.room });
    expect(PLACE_LIGHT.street.ground).toBeNull();
    expect(PLACE_LIGHT.street.haze).toBe(true);
    expect(PLACE_LIGHT.office.haze).toBe(false);
  });

  test("[assets:lighting-set-by-place] given place files, when the light each asks for is read, then a home's room light stays the room's, any other indoor place is an office and every outdoor place a street", () => {
    expect(lightKindOf({ scope: "interior", stage: { light: { room: true } } })).toBe("room");
    expect(lightKindOf({ scope: "exterior", stage: { light: { room: true } } })).toBe("room");
    expect(lightKindOf({ scope: "interior", stage: { light: {} } })).toBe("office");
    expect(lightKindOf({ scope: "exterior", stage: { light: {} } })).toBe("street");
    expect(lightKindOf({ scope: "exterior", stage: null })).toBe("street");
  });

  test("[clock:game-day-on-real-time] given a street by day, when its look is read, then its sun is warmed toward the warm one and its lights stand at the street's noon strengths; at night its lamps and sun are the night's own", () => {
    const noon = lookAt("afternoon", time.AFTERNOON_HOUR * HOUR, SUN);
    const street = placeLook(noon, "street");
    expect(street.sunStrength).toBeCloseTo(PLACE_LIGHT.street.sunStrength, 6);
    expect(street.skyStrength).toBeCloseTo(PLACE_LIGHT.street.skyStrength, 6);
    expect(warmth(street.sun)).toBeGreaterThan(warmth(noon.sun));
    expect(placeLook(noon, "room")).toEqual(roomLook(noon));
    const night = lookAt("night", 0, SUN);
    expect(placeLook(night, "street").lamps).toBe(night.lamps);
    expect(placeLook(night, "street").sun).toBe(night.sun);
  });
});
