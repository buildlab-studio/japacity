// Where the slots stand (advert:adverts-only-in-slots, advert:slots-capped-per-place): the city's billboards,
// posters and shopfronts of the place on screen, and the one phone tile. Each
// shows only a slot the hour fills; an empty board is not worth the space.
// Nothing shows offline, or wherever the view says no advert may (advert:no-adverts-on-protected-screens).
import { content } from "@japacity/content";
import type { AdvertSlotEntry } from "@japacity/sim";
import { createContext, createElement, use, useEffect, useState, type ReactNode } from "react";

import { useView } from "../../authority/GameProvider";
import { authorityMode } from "../../shared/net/authorityMode";
import { counting } from "../../shared/analytics/start";
import { regionOf } from "../../shared/net/account";
import { api, type Api } from "../../shared/net/http";
import { advertsShown, type CountAdvert } from "./advert";
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

/** The build's server, made once for the page, so every slot shares its account read and its kept hour. */
let builtServer: AdvertsServer | null | undefined;

function buildServer(): AdvertsServer | null {
  if (builtServer !== undefined) return builtServer;
  const mode = authorityMode();
  builtServer = mode.authority === "remote" ? { api: api({ baseUrl: mode.baseUrl }), baseUrl: mode.baseUrl.replace(/\/+$/, "") } : null;
  return builtServer;
}

function useAdvertsServer(): AdvertsServer | null {
  const given = use(AdvertsContext);
  return given === undefined ? buildServer() : given;
}

/** The region each server's account was made in, once known: it never changes in a page's life. */
const regions = new WeakMap<Api, string>();

function useRegion(server: AdvertsServer | null, wanted: boolean): string | null {
  const [region, setRegion] = useState<string | null>(() => (server === null ? null : (regions.get(server.api) ?? null)));
  useEffect(() => {
    if (server === null || !wanted) return;
    const known = regions.get(server.api);
    if (known !== undefined) {
      setRegion(known);
      return;
    }
    let live = true;
    // A refused read is no answer: no region yet, and the next slot to stand asks again.
    void regionOf(server.api).then((found) => {
      if (found === null) return;
      regions.set(server.api, found);
      if (live) setRegion(found);
    });
    return () => {
      live = false;
    };
  }, [server, wanted]);
  return region;
}

/** analytics:client-sends-interface-counts: impressions and taps go with the interface counters. */
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

/** The phone's one sponsored tile (advert:slots-capped-per-place). */
export function PhoneTile() {
  return <Filled place={PHONE} className="w-36" />;
}
