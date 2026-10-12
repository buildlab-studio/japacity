// The home redesign's switch (development only): `?homex=family|room|hostel` on the address opens one home's scene in
// place of the game, as `?lively` opens the layer's preview; a build for players never does.

export type HomeName = "family" | "room" | "hostel";

export function homeAsked(search: string, dev: boolean = import.meta.env.DEV): HomeName | null {
  if (!dev) return null;
  const asked = new URLSearchParams(search).get("homex");
  if (asked === null) return null;
  return asked === "room" || asked === "hostel" ? asked : "family";
}
