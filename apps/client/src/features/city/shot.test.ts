import { describe, expect, test } from "vitest";

import type { Shot } from "../../shared/world/contract";
import { stageOf } from "./placeFile";
import { roomOf, HOUSE } from "./room";
import { builtPlaces, cameraAt, onScreen, projected, SCREENS } from "./scene.testing";
import { aimShot, CLOSE_AHEAD, clampTurn, defaultShot, FIT_MARGIN, fitDistance, shotOf, snapZoom, WHOLE, wholeDistance, widthEnds } from "./shot";
import { thingSpot, thingsOf } from "./things";

/** The pitch of a view above the ground, in degrees. */
function pitchOf(aim: ReturnType<typeof aimShot>): number {
  const [px, py, pz] = aim.position;
  const [tx, ty, tz] = aim.target;
  return (Math.atan2(py - ty, Math.hypot(px - tx, pz - tz)) * 180) / Math.PI;
}

const SHOT: Shot = { centre: [2, 0, -3], far: 30, near: 9, farPitch: 55, nearPitch: 40, turn: 20, yaw: 180, width: 24 };

describe("the place's camera", () => {
  test("[R-WORLD-009] given every built place and its room, on a phone upright and sideways, a tablet and a desktop, when the place is entered, then the whole of it shows: its width end to end and every thing on screen", () => {
    const places = builtPlaces().flatMap(({ folder, file }) => [{ folder, file }, ...(folder === "family-house" ? [{ folder: "family-house room", file: roomOf(file, HOUSE) }] : [])]);
    expect(places.length).toBeGreaterThanOrEqual(10);
    for (const { folder, file } of places) {
      const stage = stageOf(file);
      const shot = shotOf(stage);
      const [x, z] = stage.start;
      for (const [screen, aspect] of Object.entries(SCREENS)) {
        const camera = cameraAt(aimShot(shot, WHOLE, { x, z }, aspect), aspect);
        for (const [ex, ey, ez] of widthEnds(shot)) expect(onScreen(camera, ex, ey, ez), `${folder} on ${screen}: the width's end at ${ex.toFixed(1)}, ${ez.toFixed(1)}`).toBe(true);
        for (const thing of thingsOf(stage)) {
          const spot = thingSpot(stage, thing);
          if (spot === null) throw new Error(`${folder}: ${thing.id} stands nowhere`);
          expect(onScreen(camera, spot[0], 0, spot[1]), `${folder} on ${screen}: ${thing.id}`).toBe(true);
        }
      }
    }
  });

  test("[R-WORLD-009] given a shot's width, when the screen is narrower, then the whole view stands further back, and the width's ends land just inside the screen's edges", () => {
    expect(fitDistance(24, SCREENS.phone)).toBeGreaterThan(fitDistance(24, SCREENS.desktop));
    const shot: Shot = { ...SHOT, far: 0 };
    const camera = cameraAt(aimShot(shot, WHOLE, { x: 0, z: 0 }, SCREENS.phone), SCREENS.phone);
    const [left, right] = widthEnds(shot).map(([x, y, z]) => projected(camera, x, y, z));
    expect(Math.abs(left?.x ?? 0)).toBeCloseTo(1 / FIT_MARGIN, 2);
    expect(Math.abs(right?.x ?? 0)).toBeCloseTo(1 / FIT_MARGIN, 2);
    // On a desktop the shot's own distance is far enough, and the width fits with room to spare.
    expect(wholeDistance(SHOT, SCREENS.desktop)).toBe(SHOT.far);
  });

  test("[R-WORLD-009] given the whole view and the close view, when each is aimed, then the camera is raised at the shot's pitch, never at eye level and never straight down, and close looks just ahead of the character", () => {
    const character = { x: 5, z: 4 };
    const whole = aimShot(SHOT, WHOLE, character, SCREENS.phone);
    expect(pitchOf(whole)).toBeCloseTo(SHOT.farPitch, 6);
    expect(whole.target).toEqual(SHOT.centre);
    const close = aimShot(SHOT, { zoom: 0, turn: 0 }, character, SCREENS.phone);
    expect(pitchOf(close)).toBeCloseTo(SHOT.nearPitch, 6);
    const [cx, , cz] = close.target;
    expect(Math.hypot(cx - character.x, cz - character.z)).toBeCloseTo(CLOSE_AHEAD, 6);
    const [px, py, pz] = close.position;
    expect(Math.hypot(px - cx, py - close.target[1], pz - cz)).toBeCloseTo(SHOT.near, 6);
    for (let zoom = 0; zoom <= 1; zoom += 0.1) {
      const pitch = pitchOf(aimShot(SHOT, { zoom, turn: 0 }, character, SCREENS.phone));
      expect(pitch).toBeGreaterThan(20);
      expect(pitch).toBeLessThan(85);
    }
  });

  test("[R-WORLD-009] given a pinch released anywhere, when it comes to rest, then the view is the whole place or close on the character and nowhere between", () => {
    for (let zoom = 0; zoom <= 1.0001; zoom += 0.01) expect([0, 1]).toContain(snapZoom(zoom));
    expect(snapZoom(0.49)).toBe(0);
    expect(snapZoom(0.5)).toBe(1);
    expect(snapZoom(0)).toBe(0);
    expect(snapZoom(1)).toBe(1);
  });

  test("[R-WORLD-009] given one finger turning the view, when it turns past the place's limit either way, then the view stops at the limit", () => {
    expect(clampTurn(SHOT, 12)).toBe(12);
    expect(clampTurn(SHOT, 45)).toBe(SHOT.turn);
    expect(clampTurn(SHOT, -45)).toBe(-SHOT.turn);
    const turned = aimShot(SHOT, { zoom: 1, turn: 90 }, { x: 0, z: 0 }, SCREENS.phone);
    const limit = aimShot(SHOT, { zoom: 1, turn: SHOT.turn }, { x: 0, z: 0 }, SCREENS.phone);
    expect(turned).toEqual(limit);
  });

  test("[R-WORLD-009] given a place file with a shot, the shot is the file's; given one without, the shot looks ahead of the start the way the start faces, raised", () => {
    const [{ file } = { file: null }] = builtPlaces();
    if (file === null) throw new Error("No place is built");
    const stage = stageOf(file);
    expect(shotOf({ ...stage, shot: SHOT })).toBe(SHOT);
    const fallback = defaultShot({ start: [1, 2, Math.PI], models: [] });
    expect(fallback.centre[0]).toBeCloseTo(1, 6);
    expect(fallback.centre[2]).toBeLessThan(2);
    expect(fallback.yaw).toBeCloseTo(180, 6);
    expect(fallback.farPitch).toBeGreaterThan(fallback.nearPitch);
    expect(fallback.width).toBeGreaterThan(0);
  });
});
