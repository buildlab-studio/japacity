// The sky and the sun by the world's clock (docs/rules/clock.md R-CLOCK-033; decision 0036): a dark view at
// night, a sunset, a morning and normal brightness by day. Each place keeps its one sun
// and its one sky light (R-ASSET-006); the part of the world's day and the minute within it only turn the sun, tint both
// lights and the sky, and light the lamps a place names. The same rule indoors and out, in every place. Pure but for the
// hook at the foot, which reads the clock the last reply carried (handed in by the city, which holds the store, so the
// scene's own chunk stays apart from it) and the device's between replies.
import { type DayPart, time, type WorldClock, worldClockAt } from "@japacity/sim";
import { useEffect, useState } from "react";
import { Color, SRGBColorSpace } from "three";

/** One look of the day: the sun's colour, strength, height and turn, the sky light's tint and strength, the lamps. */
export interface Look {
  /** The sun's colour, as 8-bit sRGB. */
  sun: number;
  /** The directional light's intensity. */
  sunStrength: number;
  /** The sun's height above the horizon in degrees; null keeps the place's own. */
  height: number | null;
  /** Degrees the sun is turned about the vertical from the place's own direction; the morning's and the evening's are opposite. */
  turn: number;
  /** The tint the sky behind the place leans to, as 8-bit sRGB, and how far: 0 is the place's own sky. */
  tint: number;
  tintShare: number;
  /** The tint the sky light itself leans to, by the same share: a pale backdrop can still light the room warm, a navy night still show it in moonlight. */
  lightTint: number;
  /** The hemisphere light's intensity. */
  skyStrength: number;
  /** How much of the ground's colour the hemisphere's lower half keeps: dark at night. */
  groundShare: number;
  /** How soft the sun's shadow is (the shadow map's radius): long soft shadows in the morning. */
  softness: number;
  /** The lamps' glow, 0 out to 1 full: the bulb, the lantern, the street's few lights. */
  lamps: number;
}

/** The afternoon's sun and sky: each place's own sun, a white light, its own sky, untinted. */
const NOON: Look = { sun: 0xfff0d0, sunStrength: 2, height: null, turn: 0, tint: 0xffffff, tintShare: 0, lightTint: 0xffffff, skyStrength: 1.1, groundShare: 1, softness: 1, lamps: 0 };

/** Each part's look at its start and at its end; within a part the look moves from one to the other with the minute. */
export const LOOKS: Record<DayPart, { from: Look; to: Look }> = {
  // A low warm sun, long soft shadows, a pale sky, rising toward the day's full light.
  morning: {
    from: { sun: 0xffa860, sunStrength: 2.6, height: 16, turn: -65, tint: 0xeef1ef, tintShare: 0.7, lightTint: 0xf2eee6, skyStrength: 0.8, groundShare: 0.8, softness: 3, lamps: 0 },
    to: { sun: 0xfff1d8, sunStrength: 2.1, height: 48, turn: -20, tint: 0xf3f0e6, tintShare: 0.3, lightTint: 0xfff0d8, skyStrength: 1.05, groundShare: 1, softness: 1.5, lamps: 0 },
  },
  // Full white light, the place as it was always lit, the sun moving over toward the evening's side.
  afternoon: {
    from: NOON,
    to: { ...NOON, sun: 0xffe4b8, sunStrength: 1.95, height: 34, turn: 45, softness: 1.5 },
  },
  // An orange sun low on the other side, the sky warming, then dusk and the lamps coming on.
  evening: {
    from: { sun: 0xff9b52, sunStrength: 2.2, height: 14, turn: 115, tint: 0xf2a774, tintShare: 0.5, lightTint: 0xf0a070, skyStrength: 0.85, groundShare: 0.8, softness: 2.5, lamps: 0.5 },
    to: { sun: 0xd0684a, sunStrength: 0.9, height: 5, turn: 125, tint: 0x3b3768, tintShare: 0.85, lightTint: 0x9a88c0, skyStrength: 0.9, groundShare: 0.45, softness: 3, lamps: 1 },
  },
  // A deep blue sky with the sun almost out: the room is lit by its bulb and the lantern.
  night: {
    from: { sun: 0x6f86c8, sunStrength: 0.35, height: 42, turn: 180, tint: 0x0e1735, tintShare: 0.95, lightTint: 0x6a82c4, skyStrength: 1.1, groundShare: 0.3, softness: 2, lamps: 1 },
    to: { sun: 0x6f86c8, sunStrength: 0.35, height: 42, turn: 180, tint: 0x0e1735, tintShare: 0.95, lightTint: 0x6a82c4, skyStrength: 1.1, groundShare: 0.3, softness: 2, lamps: 1 },
  },
};

const { MORNING_HOUR, AFTERNOON_HOUR, EVENING_HOUR, NIGHT_HOUR, GAME_HOURS } = time;
const DAY_MINUTES = GAME_HOURS * 60;
/** Where each part begins, in minutes of the day. */
const STARTS: Record<DayPart, number> = { morning: MORNING_HOUR * 60, afternoon: AFTERNOON_HOUR * 60, evening: EVENING_HOUR * 60, night: NIGHT_HOUR * 60 };
const NEXT: Record<DayPart, DayPart> = { morning: "afternoon", afternoon: "evening", evening: "night", night: "morning" };
/** The last hour of the night grows toward the morning's first light, so six o'clock is no jump. */
const DAWN_MINUTES = 60;

/** How far through its part a minute of the day stands, 0 at the part's start to 1 at its end. */
export function progressIn(part: DayPart, minute: number): number {
  const start = STARTS[part];
  const end = STARTS[NEXT[part]];
  const length = (end - start + DAY_MINUTES) % DAY_MINUTES;
  const into = (minute - start + DAY_MINUTES) % DAY_MINUTES;
  return Math.min(1, Math.max(0, into / length));
}

/**
 * Two colours mixed as they are written and seen (sRGB), not in light's own linear terms, where a little of a bright sky
 * would grey a whole night: the share of navy is the share seen.
 */
export function mixSeen(from: Color, to: Color, share: number): Color {
  const a = from.getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  const b = to.getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  return new Color().setRGB(a.r + (b.r - a.r) * share, a.g + (b.g - a.g) * share, a.b + (b.b - a.b) * share, SRGBColorSpace);
}

function mixColour(from: number, to: number, share: number): number {
  return mixSeen(new Color(from), new Color(to), share).getHex();
}

function mixNumber(from: number, to: number, share: number): number {
  return from + (to - from) * share;
}

/** The look between two looks; a height kept as the place's own stays so until both name one. */
export function mixLooks(from: Look, to: Look, share: number, ownHeight: number): Look {
  return {
    sun: mixColour(from.sun, to.sun, share),
    sunStrength: mixNumber(from.sunStrength, to.sunStrength, share),
    height: mixNumber(from.height ?? ownHeight, to.height ?? ownHeight, share),
    turn: mixNumber(from.turn, to.turn, share),
    tint: mixColour(from.tint, to.tint, share),
    tintShare: mixNumber(from.tintShare, to.tintShare, share),
    lightTint: mixColour(from.lightTint, to.lightTint, share),
    skyStrength: mixNumber(from.skyStrength, to.skyStrength, share),
    groundShare: mixNumber(from.groundShare, to.groundShare, share),
    softness: mixNumber(from.softness, to.softness, share),
    lamps: mixNumber(from.lamps, to.lamps, share),
  };
}

/** The place's own sun height in degrees, from its sun's direction. */
export function ownHeightOf(sun: readonly [number, number, number]): number {
  return (Math.atan2(sun[1], Math.hypot(sun[0], sun[2])) * 180) / Math.PI;
}

/** The look of the day at a part and a minute, for a place whose own sun stands at `sun`. */
export function lookAt(part: DayPart, minute: number, sun: readonly [number, number, number]): Look {
  const own = ownHeightOf(sun);
  const { from, to } = LOOKS[part];
  const share = progressIn(part, minute);
  if (part !== "night") return mixLooks(from, to, share, own);
  // Toward six the night pales into the morning's first light.
  const length = (STARTS.morning - STARTS.night + DAY_MINUTES) % DAY_MINUTES;
  const dawn = Math.max(0, (share * length - (length - DAWN_MINUTES)) / DAWN_MINUTES);
  return mixLooks(from, LOOKS.morning.from, dawn * dawn, own);
}

/** Where the sun stands from the place's centre for a look: the place's own direction turned, at the look's height, as far away. */
export function sunAt(sun: readonly [number, number, number], look: Pick<Look, "height" | "turn">): [number, number, number] {
  const far = Math.hypot(sun[0], sun[1], sun[2]);
  const flat = Math.atan2(sun[2], sun[0]) - (look.turn * Math.PI) / 180;
  const height = ((look.height ?? ownHeightOf(sun)) * Math.PI) / 180;
  const across = Math.cos(height) * far;
  return [Math.cos(flat) * across, Math.sin(height) * far, Math.sin(flat) * across];
}

/** The sky's colour behind the place for a look: the place's own sky leaning toward the look's tint. */
export function skyOf(own: Color, look: Pick<Look, "tint" | "tintShare">): Color {
  return mixSeen(own, new Color(look.tint), look.tintShare);
}

/** The sky light's own colour for a look: the place's own sky leaning toward the look's light tint. */
export function skyLightOf(own: Color, look: Pick<Look, "lightTint" | "tintShare">): Color {
  return mixSeen(own, new Color(look.lightTint), look.tintShare);
}

/**
 * The rooms' light: by day a paler, cooler sky light over a warm
 * floor, a warm sun a little stronger and a pale sky behind; by night the bulb and the lantern as real lights. A place
 * whose light says `room` takes these for its own sky, ground and backdrop, and the clock turns and tints them as any.
 */
export const ROOM_LIGHT = { sky: 0xdfe8f4, ground: 0xcdb48c, backdrop: 0xeef1f8, sun: 0xffdcaa, skyStrength: 1.35, sunStrength: 2.3, lamp: 0xffb46a } as const;

/** Which of the layer's lights a place takes: a home's rooms, an office or another room, or a street. */
export type LightKind = "room" | "office" | "street";

/**
 * The layer's light for every place: the paler, cooler sky light with the warm sun, the
 * pale sky behind. `ground` is the floor's bounce, null where the place's own ground
 * colour bounces (a street's road and laterite); `warm` is how far the sun leans toward the warm one by day; `haze`
 * whether the fog still fades the far end, into the pale sky. An office takes the rooms' numbers: a warmer, lighter floor.
 */
export const PLACE_LIGHT: Record<LightKind, { sky: number; ground: number | null; backdrop: number; sun: number; warm: number; skyStrength: number; sunStrength: number; haze: boolean }> = {
  room: { sky: ROOM_LIGHT.sky, ground: ROOM_LIGHT.ground, backdrop: ROOM_LIGHT.backdrop, sun: ROOM_LIGHT.sun, warm: 0.6, skyStrength: ROOM_LIGHT.skyStrength, sunStrength: ROOM_LIGHT.sunStrength, haze: false },
  office: { sky: ROOM_LIGHT.sky, ground: ROOM_LIGHT.ground, backdrop: ROOM_LIGHT.backdrop, sun: ROOM_LIGHT.sun, warm: 0.6, skyStrength: ROOM_LIGHT.skyStrength, sunStrength: ROOM_LIGHT.sunStrength, haze: false },
  street: { sky: ROOM_LIGHT.sky, ground: null, backdrop: ROOM_LIGHT.backdrop, sun: ROOM_LIGHT.sun, warm: 0.45, skyStrength: 1.25, sunStrength: 2.15, haze: true },
};

/** The light a place file asks for: a home's `light.room`, any other indoor place an office's, every outdoor place a street's. */
export function lightKindOf(file: { scope: "exterior" | "interior"; stage?: { light: { room?: boolean } } | null }): LightKind {
  if (file.stage?.light.room === true) return "room";
  return file.scope === "interior" ? "office" : "street";
}

/** The day's look under a kind of light: the sun warmed toward the warm one by day and both lights as strong as the kind's are at noon. */
export function placeLook(look: Look, kind: LightKind): Look {
  const light = PLACE_LIGHT[kind];
  const day = 1 - look.lamps;
  return {
    ...look,
    sun: mixColour(look.sun, light.sun, light.warm * day),
    sunStrength: look.sunStrength * (light.sunStrength / NOON.sunStrength),
    skyStrength: look.skyStrength * (light.skyStrength / NOON.skyStrength),
  };
}

/** The day's look in a room: the sun warmed toward the room's own by day and both lights as strong as the room's are at noon. */
export function roomLook(look: Look): Look {
  return placeLook(look, "room");
}

/** The parts the development switch may pin, each at a minute that reads as that part. */
const PINNED_MINUTE: Record<DayPart, number> = { morning: 8 * 60, afternoon: 14 * 60, evening: 19 * 60, night: 0 };

/** The part a page's `?clock=` pins, in development only, for pictures and tests; null otherwise. */
export function pinnedPart(search: string, development: boolean): DayPart | null {
  if (!import.meta.env.DEV || !development) return null;
  const asked = new URLSearchParams(search).get("clock");
  return asked === "morning" || asked === "afternoon" || asked === "evening" || asked === "night" ? asked : null;
}

/** A clock that stands at a pinned part. */
export function pinnedClock(part: DayPart): Pick<WorldClock, "part" | "minute"> {
  return { part, minute: PINNED_MINUTE[part] };
}

/**
 * The world's clock now: the device's reading, moved by how far the last reply's reading stood from the device's when it
 * came, so the server's reading wins on a reply and the device carries it on between replies (R-CLOCK-033).
 */
export function worldNow(now: number, reply: { world: WorldClock; at: number } | null): WorldClock {
  if (reply === null) return worldClockAt(now);
  const minuteMs = time.GAME_DAY_MS / DAY_MINUTES;
  const device = worldClockAt(reply.at);
  const ahead = (reply.world.day - device.day) * DAY_MINUTES + (reply.world.minute - device.minute);
  return worldClockAt(now + ahead * minuteMs);
}

/** The device reads the clock this often between replies: a real minute, twelve of the game's. */
const READ_MS = 60_000;

/** The part of the world's day and its minute, for the scene: pinned in development by `?clock=`, else the world's clock from the last reply's `world` and the device. */
export function useDayClock(world: WorldClock | null): Pick<WorldClock, "part" | "minute"> {
  const [reply, setReply] = useState<{ world: WorldClock; at: number } | null>(null);
  useEffect(() => {
    if (world !== null) setReply({ world, at: Date.now() });
  }, [world]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), READ_MS);
    return () => window.clearInterval(timer);
  }, []);
  const pinned = pinnedPart(typeof window === "undefined" ? "" : window.location.search, import.meta.env.DEV);
  if (pinned !== null) return pinnedClock(pinned);
  const clock = worldNow(now, reply);
  return { part: clock.part, minute: clock.minute };
}
