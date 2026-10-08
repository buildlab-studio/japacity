// Where the slots stand (R-ADVERT-001, R-ADVERT-002): the city's billboards,
// posters and shopfronts of the place on screen, and the one phone tile. Each
// shows only a slot the hour fills; an empty board is not worth the space.
// Nothing shows offline, or wherever the view says no advert may (R-ADVERT-003).
import { content } from "@japacity/content";
import type { AdvertSlotEntry } from "@japacity/sim";
import { createContext, createElement, use, useEffect, useMemo, useState, type ReactNode } from "react";

import { useView } from "../../authority/GameProvider";
import { authorityMode } from "../../authority/mode";
import { counting } from "../../shared/analytics/start";
import { regionOf } from "../../shared/net/account";
import { api, type Api } from "../../shared/net/http";
import { advertsShown, type CountAdvert } from "./adverts";
import { AdvertSlot } from "./AdvertSlot";
import { useAdverts } from "./useAdverts";

export interface AdvertsServer {
  api: Api;
  /** Where the images are; their paths are relative to it. */
  baseUrl: string;
}

/** Undefined: decide from the build. Null: offline. */
const AdvertsContext = createContext<AdvertsServer | null | undefined>(undefined);

export function AdvertsProvider({ value, children }: { value: AdvertsServer | null; children: ReactNode }) {
  return createElement(AdvertsContext, { value }, children);
}

function useAdvertsServer(): AdvertsServer | null {
  const given = use(AdvertsContext);
  const built = useMemo(() => {
    if (given !== undefined) return null;
    const mode = authorityMode();
    return mode.authority === "remote" ? { api: api({ baseUrl: mode.baseUrl }), baseUrl: mode.baseUrl.replace(/\/+$/, "") } : null;
  }, [given]);
  return given === undefined ? built : given;
}

function useRegion(server: AdvertsServer | null, wanted: boolean): string | null {
  const [region, setRegion] = useState<string | null>(null);
  useEffect(() => {
    if (server === null || !wanted) return;
    let live = true;
    void regionOf(server.api).then((found) => {
      if (live) setRegion(found);
    });
    return () => {
      live = false;
    };
  }, [server, wanted]);
  return region;
}

/** R-ANALYTICS-002: impressions and taps go with the interface counters. */
const count: CountAdvert = (name, key) => counting().count(name, key);

const SLOTS = Object.values(content.advert);

/** The phone tile's place, as packages/content/src/advert/advert.data.ts names it: the app grid is not a place in the city. */
const PHONE = "phone";

/** The slots standing at `place`: the city's for a place, the phone's for PHONE. */
export function slotsAt(place: string): AdvertSlotEntry[] {
  return SLOTS.filter((slot) => slot.place === place && (place === PHONE) === (slot.surface === "phone-tile"));
}

function Filled({ place, className }: { place: string; className: string }) {
  const view = useView();
  const server = useAdvertsServer();
  const slots = slotsAt(place);
  const shown = server !== null && slots.length > 0 && advertsShown(view);
  const region = useRegion(server, shown);
  const reply = useAdverts(server?.api ?? null, region, shown);
  if (!shown || server === null || reply === null) return null;
  const filled = slots.filter((slot) => reply.slots[slot.id] !== undefined);
  if (filled.length === 0) return null;
  return (
    <div className={`flex flex-col gap-2 ${className}`} data-adverts-at={place}>
      {filled.map((slot) => (
        <AdvertSlot key={slot.id} slot={slot.id} served={reply.slots[slot.id]} baseUrl={server.baseUrl} onCount={count} />
      ))}
    </div>
  );
}

/** The billboards, posters and shopfronts of a place in the city. */
export function PlaceAdverts({ place }: { place: string }) {
  // The overlay above the city lets taps through only where it says so.
  return <Filled place={place} className="pointer-events-auto w-full max-w-xs" />;
}

/** The phone's one sponsored tile (R-ADVERT-002). */
export function PhoneTile() {
  return <Filled place={PHONE} className="w-36" />;
}
