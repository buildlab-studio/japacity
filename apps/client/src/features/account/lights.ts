// The two lights' figures (account:two-lights-and-wink-lines): online, the server's counts of lives at home and
// abroad, the whole game's, rounded to the nearest ten (`GET /api/lights`); with no answer, the city's own people
// stand in: the residents of every place at home and of every place abroad, as content sizes their crowds
// (city:residents-fill-to-target). Each light glows with its share, and home never goes dark.
import type { LightsReply } from "@japacity/api";
import { content } from "@japacity/content";
import { useEffect, useState } from "react";

import { authorityMode } from "../../shared/net/authorityMode";
import { api } from "../../shared/net/http";
import type { WallGuard } from "../../shared/net/wall";

/** What the lights show: still asking, the server's lives, or the city's own people standing in. */
export type LightsShown = { from: "asking" } | { from: "server" | "city"; home: number; abroad: number };

/** Reads the server's counts; null with no answer. */
export type ReadLights = () => Promise<LightsReply | null>;

const BP = 10_000;

/** Home never goes dark: the least share its glow is drawn with. New lives start there, and some stay by choice. */
export const HOME_FLOOR_BP = 3_000;

/** The city's own people: every place's crowd at home and abroad, as content sizes them. */
export function cityPeople(): { home: number; abroad: number } {
  let home = 0;
  let abroad = 0;
  for (const place of Object.values(content.place)) {
    if (place.where === "home") home += place.crowd.target;
    else if (place.where === "abroad") abroad += place.crowd.target;
  }
  return { home, abroad };
}

/** The share each light glows with, in basis points: by its count, an even split with none, home never under its floor. */
export function sharesOf(shown: LightsShown): { homeBp: number; abroadBp: number } {
  const total = shown.from === "asking" ? 0 : shown.home + shown.abroad;
  const homeBp = shown.from === "asking" || total === 0 ? BP / 2 : Math.max(HOME_FLOOR_BP, Math.floor((shown.home * BP) / total));
  return { homeBp, abroadBp: BP - homeBp };
}

/**
 * A picture never moves the page: a login wall met by this read is left to the account's own reads, which reload for it
 * (engine:browser-authority-for-dev-only), and a reply here neither sets nor clears their mark.
 */
const QUIET_WALL: WallGuard = { met: () => false, passed: () => undefined };

/** The server's read where the build has a server; none in a build that plays on the device. */
function serverRead(): ReadLights | null {
  const mode = authorityMode();
  if (mode.authority !== "remote") return null;
  const server = api({ baseUrl: mode.baseUrl, wall: QUIET_WALL });
  return async () => {
    const reply = await server.get<LightsReply | { ok: false }>("/api/lights");
    return reply.ok ? reply : null;
  };
}

/** The figures for the lights: asked once while they hang; any failure is the city's own people, never an error. `read`: a seam for tests. */
export function useLights(read?: ReadLights | null): LightsShown {
  const [reader] = useState(() => (read === undefined ? serverRead() : read));
  const [shown, setShown] = useState<LightsShown>(() => (reader === null ? { from: "city", ...cityPeople() } : { from: "asking" }));
  useEffect(() => {
    if (reader === null) return;
    let live = true;
    const settle = (reply: LightsReply | null) => {
      if (live) setShown(reply === null ? { from: "city", ...cityPeople() } : { from: "server", home: reply.home, abroad: reply.abroad });
    };
    reader().then(settle, () => settle(null));
    return () => {
      live = false;
    };
  }, [reader]);
  return shown;
}
