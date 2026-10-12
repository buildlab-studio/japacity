// The home redesign's switch (development only): `?homex=<home>` on the address opens one home's scene in place of the
// game, as `?lively` opens the layer's preview; a build for players never does. Round 1 staged each home as one view
// (`family`, `room`, `hostel`); round 2 splits each into the room alone and the yard behind its door.

export const HOMES = ["family", "room", "hostel", "family-room", "family-yard", "room-room", "room-yard", "hostel-room", "hostel-yard"] as const;

export type HomeName = (typeof HOMES)[number];

export function homeAsked(search: string, dev: boolean = import.meta.env.DEV): HomeName | null {
  if (!dev) return null;
  const asked = new URLSearchParams(search).get("homex");
  if (asked === null) return null;
  return HOMES.find((home) => home === asked) ?? "family-room";
}
