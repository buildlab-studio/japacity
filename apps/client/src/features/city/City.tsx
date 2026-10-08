// The city (docs/rules/city.md): a full-screen scene under the panels, brought in front of them by
// "Look around". It reads the view and never changes it: entering a place, walking and tapping are
// this screen's own state, and nothing here sends a command (R-CITY-001). The 3D scene is loaded
// only where WebGL exists, so the panels never wait for it (R-CITY-018).
import { content, text } from "@japacity/content";
import type { Id, PlaceEntry } from "@japacity/sim";
import { Map as MapIcon, Moon, Settings2, Smartphone, X } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { chooseGraphics, setGraphicsMode } from "../../shared/graphics/mode";
import { assetUrl, loadJson, loadManifest } from "../../shared/three/manifest";
import { Button } from "../../shared/ui/Button";
import { Sheet } from "../../shared/ui/Sheet";
import { formatMoney } from "../../shared/words/format";
import { nameOf, words } from "../../shared/words/text";
import { cityWords, heardWords, placeName, residentName, roleWords } from "./city.words";
import { CreditsSheet } from "./Credits";
import { type CountryChoice, FlyOver, type Pin, type PinState } from "./FlyOver";
import { OVERVIEW } from "./CityScene";
import { Phone, type PhoneApp } from "./Phone";
import { localDate, type Other, poolOf, sampleCrowd } from "./crowd";
import { type Device, enterPlace, keepChoice, type Mode, type ModeChoice, modeSettings, observeFrame, readChoice, startingMode, watchFrames } from "./mode";
import { overheard } from "./overheard";
import { dancerShown, dressPlace, openGround, type PlaceFile, stageOf } from "./placeFile";
import { personOfLook } from "./roster";
import type { Mark, Picked } from "./scene.types";
import { enterable, offersHere, openingPlace, openScene, reportHere, type ViewPlace } from "./staging";

const CityScene = lazy(() => import("./CityScene"));

const city = content.tuning.city;
const PLACES = Object.values(content.place);
/** How long a line overheard stays before the next is heard. */
const HEARD_MS = 9000;
const FALLBACK_OWN = "shared/chr/chr_tunde.glb";

// The world mode (docs/design/11-the-world-first.md), a prototype the maintainer judges before it becomes rules.
const LAST_KEY = "japacity.city.last";
const BEEN_KEY = "japacity.city.been";
/** The thing on a street that stages an action, by the end of its model's file. */
const ACTIONS: Record<string, string> = {
  "shop_lotto-kiosk.glb": "activity.play-lotto",
  "bld_bode-thomas-betting.glb": "activity.bet-slip",
};
/** The things that give a ride, by the end of their model's file (rule 13). */
const RIDES: Record<string, string> = { "veh_danfo.glb": "danfo", "veh_keke.glb": "keke", "veh_okada.glb": "okada" };
/** Buildings that are doors into a place of their own, by the end of their model's file (rule 13). None of the built places has one yet. */
const DOORS: Record<string, string> = {};
/** Buildings the character steps inside (rule 14), by the end of their model's file. */
const INSIDE = ["bld_family-house.glb"];
/** How long the cut to another scene stays dark, in milliseconds. */
const CUT_MS = 320;

/**
 * The room inside a building, as its own small scene cut from the place's file (rule 14): the floor
 * under the building, the furniture and people that stand there, and the door as the start. The
 * building itself is left out, so the room is seen from above like any place.
 */
function roomOf(file: PlaceFile, building: string): PlaceFile {
  const stage = stageOf(file);
  const spot = stage.models.find((model) => model.file.endsWith(building))?.at[0] ?? stage.start;
  const [x, z] = [spot[0], spot[1]];
  const half: [number, number] = [9, 8];
  const within = ([px, pz]: readonly number[]): boolean => Math.abs((px ?? 0) - x) <= half[0] && Math.abs((pz ?? 0) - z) <= half[1];
  const people = stage.people.filter(within);
  const room = {
    ...stage,
    // The floor is the building's footprint; the compound and the city beyond are gone.
    ground: { colour: "concrete" as const, size: [half[0] * 2, half[1] * 2] as [number, number] },
    roads: [],
    start: [x, z + half[1] - 1, Math.PI] as typeof stage.start,
    walkable: [[[x - half[0], z - half[1]], [x + half[0], z - half[1]], [x + half[0], z + half[1]], [x - half[0], z + half[1]]]] as NonNullable<typeof stage.walkable>,
    models: stage.models.filter((model) => !/\/bld_[^/]*\.glb$/.test(model.file)).map((model) => ({ ...model, at: model.at.filter(within) })).filter((model) => model.at.length > 0),
    people: people.length > 0 ? people : stage.people.slice(0, 2),
  };
  return { ...file, stage: room };
}
/** Minutes by road between two places, from their positions: a base wait and a Lagos pace. */
function minutesBetween(from: { latE3: number; lonE3: number }, to: { latE3: number; lonE3: number }): number {
  const cos = Math.cos((from.latE3 / 1000) * (Math.PI / 180));
  const metres = Math.hypot((to.lonE3 - from.lonE3) * 111.32 * cos, (to.latE3 - from.latE3) * 111.32);
  return 8 + Math.round(metres / 120);
}
/** The label over each thing the player can tap, by the end of its model's file (rule 3). */
const THING_WORDS: Record<string, string> = {
  "shop_lotto-kiosk.glb": "city.thing.lotto",
  "bld_bode-thomas-betting.glb": "city.thing.bets",
  "veh_danfo.glb": "city.thing.danfo",
  "veh_keke.glb": "city.thing.keke",
  "veh_okada.glb": "city.thing.okada",
  "bld_family-house.glb": "city.thing.house",
};
/** The two camera presets beside the pinch: close to the character, and the whole place. */
const ZOOM = { closer: 0.08, whole: OVERVIEW.start };
/** The home of each where: the family house, then the room abroad. */
const HOMES: Record<string, string> = { home: "place.family-house", abroad: "place.the-room" };
/** The family house stands on a made-up street (city.md), so the map gives it a spot in Surulere near the hub. */
const HOME_SPOT = { latE3: 6507, lonE3: 3359 };
/** The countries the map can show, with why the others are shut, until the view says more. */
const COUNTRIES = ["country.uk", "country.uae", "country.canada", "country.italy"];

function readKept(key: string): string[] {
  try {
    const kept = window.localStorage.getItem(key);
    const parsed: unknown = kept === null ? [] : JSON.parse(kept);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function keep(key: string, value: string[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A private window may refuse storage; the place then lasts the session only.
  }
}

/** Where the player last stopped, when it is a place they can still enter (rule 7), or the hub. */
function lastPlace(here: ViewPlace): string {
  const kept = readKept(LAST_KEY)[0];
  const open = enterable(here, PLACES);
  if (kept !== undefined && open.some((place) => place.id === kept)) return kept;
  const home = HOMES[here.where];
  return home !== undefined && open.some((place) => place.id === home) ? home : openingPlace(here, PLACES);
}

// the store on a branch keeps `presence` as { place, others: { name, look }[] }; the look is read as a chr_ name and the sample is used only when its place is the one shown.
/** The presence sample the online store keeps (R-CITY-015), with those seen today (R-CITY-036) once the store has them; absent offline. */
interface PresenceSample {
  place: string;
  others: { name: string | null; look: string }[];
  today?: { name: string | null; look: string }[];
}

function canDraw(): boolean {
  if (typeof window === "undefined" || !("WebGL2RenderingContext" in window)) return false;
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

function device(): Device {
  return {
    finePointer: typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches,
    width: window.innerWidth,
    pixelRatio: window.devicePixelRatio,
  };
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The player's own look: the starting life's person where one is shipped. */
function ownFile(scenario: string): string {
  return personOfLook(`chr_${scenario.slice("scenario.".length)}`)?.file ?? FALLBACK_OWN;
}

function entryOf(id: string): PlaceEntry | null {
  return content.place[id as Id<"place">] ?? null;
}

/** A place's file, fetched by its hashed name when the place is entered (R-CITY-018). */
function usePlaceFile(place: PlaceEntry | null, drawing: boolean): PlaceFile | null {
  const [file, setFile] = useState<{ place: string; file: PlaceFile } | null>(null);
  useEffect(() => {
    if (place === null || !drawing) return;
    let alive = true;
    void loadManifest()
      .then((manifest) => loadJson<PlaceFile>(manifest, `places/${place.assets}/place.json`))
      .catch(() => null)
      .then((found) => {
        if (alive) setFile({ place: place.id, file: found ?? openGround(place.id) });
      });
    return () => {
      alive = false;
    };
  }, [place, drawing]);
  return place !== null && file?.place === place.id ? file.file : null;
}

function PersonCard({ picked, onClose, words: said }: { picked: Picked; onClose: () => void; words: string }) {
  return (
    <div role="dialog" aria-label={said} className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-lg" data-card={picked.kind}>
      <p className="flex-1">{said}</p>
      <button type="button" aria-label={cityWords("city.close")} onClick={onClose} className="inline-flex size-9 items-center justify-center rounded-lg border border-line">
        <X size={18} />
      </button>
    </div>
  );
}

/** `adverts`: the shell's advert slots for the place on screen (R-ADVERT-001), placed beside what is said there. */
export function City({
  adverts,
  world = false,
  actions,
  month,
  apps,
}: {
  adverts?: (place: string) => ReactNode;
  /** The world mode: the place fills the screen under a see-through bar, with the fly-over as its map. */
  world?: boolean;
  /** The world mode's sheet for the actions a tapped thing stages. */
  actions?: (ids: string[]) => ReactNode;
  /** The world mode's month control, shown in the Month sheet. */
  month?: ReactNode;
  /** The world mode's phone: the support pages as apps (section 2b). */
  apps?: readonly PhoneApp[];
} = {}) {
  const view = useView();
  const presence = useGame((state) => (state as { presence?: PresenceSample | null }).presence ?? null);
  const drawing = useMemo(canDraw, []);
  const [date] = useState(() => localDate(new Date()));
  const [looking, setLooking] = useState(world);
  const [map, setMap] = useState(false);
  const [inside, setInside] = useState(false);
  const [phone, setPhone] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [zoom, setZoom] = useState(ZOOM.whole);
  const plan = useGame((state) => state.plan);
  const [cutting, setCutting] = useState(false);
  const [diveTo, setDiveTo] = useState<string | null>(null);
  const [shipped, setShipped] = useState<Set<string> | null>(null);
  const [menu, setMenu] = useState(false);
  const [credits, setCredits] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [heardCount, setHeardCount] = useState(0);
  const [choice, setChoice] = useState<ModeChoice>(() => readChoice(storage()));
  const [mode, setMode] = useState<Mode>(() => startingMode(device(), city, choice));
  const watch = useRef(watchFrames(mode, choice !== "auto"));
  useEffect(() => setGraphicsMode(mode), [mode]);

  const where = view.place.where;
  const country = view.place.country;
  const here = useMemo(() => ({ where, country }), [where, country]);
  const [placeId, setPlaceId] = useState<string>(() => (world ? lastPlace(here) : openingPlace(here, PLACES)));
  // A new where (home, abroad, the road) opens its own hub (R-CITY-012, R-CITY-013).
  useEffect(() => {
    setPlaceId(world ? lastPlace(here) : openingPlace(here, PLACES));
  }, [here, world]);
  // The world mode remembers where the player stopped and where they have been (rules 5 and 7).
  useEffect(() => {
    if (!world) return;
    keep(LAST_KEY, [placeId]);
    const been = readKept(BEEN_KEY);
    if (!been.includes(placeId)) keep(BEEN_KEY, [...been, placeId]);
  }, [world, placeId]);
  useEffect(() => {
    if (!world || !drawing) return;
    let alive = true;
    void loadManifest()
      .then((manifest) => {
        if (alive) setShipped(new Set(PLACES.filter((place) => assetUrl(manifest, `places/${place.assets}/place.json`) !== null).map((place) => place.id)));
      })
      .catch(() => {
        if (alive) setShipped(new Set());
      });
    return () => {
      alive = false;
    };
  }, [world, drawing]);
  // An open set piece is shown where it is staged (R-CITY-011).
  const scene = openScene(view, PLACES);
  const sceneAt = scene?.place ?? null;
  useEffect(() => {
    if (sceneAt !== null) setPlaceId(sceneAt);
  }, [sceneAt]);
  useEffect(() => {
    watch.current = enterPlace(watch.current);
    setInside(false);
    setPicked(null);
    setFailed(null);
    setProgress(null);
  }, [placeId]);
  useEffect(() => {
    if (!looking) return;
    const timer = window.setInterval(() => setHeardCount((count) => count + 1), HEARD_MS);
    return () => window.clearInterval(timer);
  }, [looking]);

  const entry = entryOf(placeId);
  const plainFile = usePlaceFile(entry, drawing);
  const offers = entry === null ? [] : offersHere(view, entry.id, PLACES);
  const openKey = offers.join("|");
  // An open offer the place stages dresses it (R-CITY-011): the party set and its guests at the family house.
  const dressed = useMemo(() => (plainFile === null ? null : dressPlace(plainFile, openKey === "" ? [] : openKey.split("|"))), [plainFile, openKey]);
  const outsideFile = dressed?.file ?? null;
  // Inside, the scene is the room cut from the place's file (rule 14).
  const file = useMemo(() => (outsideFile !== null && inside ? roomOf(outsideFile, INSIDE[0] ?? "") : outsideFile), [outsideFile, inside]);
  const settings = modeSettings(mode, device(), city);
  const others = useMemo<Other[]>(() => (presence !== null && presence.place === placeId ? presence.others : []), [presence, placeId]);
  const today = useMemo<Other[]>(() => (presence !== null && presence.place === placeId ? (presence.today ?? []) : []), [presence, placeId]);
  const own = ownFile(view.scenario);
  // No resident wears the player's own outfit or a dancer's.
  const sample = useMemo(
    () =>
      entry === null || file === null
        ? null
        : sampleCrowd({ ...entry, crowd: dressed?.crowd ?? entry.crowd }, poolOf(file.people.sample), date, mode, city, others, today, [own, ...(stageOf(file).dancers ?? []).map((dancer) => dancer.file)]),
    [entry, file, dressed, date, mode, others, today, own],
  );
  const places = enterable(here, PLACES);
  const heard = entry === null ? null : overheard(view, entry.id, date, heardCount);
  const lines = entry === null ? [] : reportHere(view, entry.id, PLACES);
  const ready = progress !== null && progress.loaded >= progress.total && failed === null;
  const name = entry === null ? "" : placeName(entry.id);

  const choose = (next: ModeChoice): void => {
    chooseGraphics(next);
    keepChoice(storage(), next);
    setChoice(next);
    const nextMode = startingMode(device(), city, next);
    watch.current = watchFrames(nextMode, next !== "auto");
    setMode(nextMode);
  };

  const cardWords = (): string => {
    if (picked === null || sample === null) return "";
    switch (picked.kind) {
      case "own":
        return cityWords("city.you");
      case "person": {
        const shown = sample.people.find((person) => person.slot === picked.slot) ?? (file === null ? undefined : dancerShown(stageOf(file), picked.slot));
        if (shown === undefined) return "";
        if (shown.kind === "player") return shown.tag === null ? cityWords("city.card.stranger") : cityWords("city.card.player", { name: shown.tag });
        return cityWords("city.card.resident", { name: residentName(shown.person.sex, placeId, date, shown.slot), role: roleWords(shown.person.role) });
      }
      case "model": {
        const signs = picked.signs.map((key) => text[key] ?? "").filter((said) => said.trim() !== "");
        return signs.length === 0 ? name : signs.map((said) => said.replace(/\n/g, " ")).join(". ");
      }
      case "action":
        return nameOf(picked.activity);
      case "ride":
        return cityWords(`city.ride.${picked.vehicle}`);
      case "enter":
        return placeName(picked.place);
      case "inside":
        return cityWords("city.inside.name", { place: name });
      case "out":
        return cityWords("city.thing.out");
      default: {
        const never: never = picked;
        throw new Error(`Unknown pick: ${JSON.stringify(never)}`);
      }
    }
  };

  const actionOf = (file: string): Picked | null => {
    const action = Object.entries(ACTIONS).find(([suffix]) => file.endsWith(suffix))?.[1] ?? null;
    if (action !== null && entry !== null && (entry.stages as readonly string[]).includes(action) && view.activities.some((option) => option.id === action)) return { kind: "action", activity: action };
    const vehicle = Object.entries(RIDES).find(([suffix]) => file.endsWith(suffix))?.[1] ?? null;
    if (vehicle !== null) return { kind: "ride", vehicle };
    if (!inside && INSIDE.some((suffix) => file.endsWith(suffix))) return { kind: "inside" };
    const door = Object.entries(DOORS).find(([suffix]) => file.endsWith(suffix))?.[1] ?? null;
    if (door !== null && places.some((place) => place.id === door)) return { kind: "enter", place: door };
    return null;
  };
  // A ride plays as the fly-over's dive, then the place opens (rule 13).
  const travel = (id: string): void => {
    setPicked(null);
    setDiveTo(id);
    setMap(true);
  };
  // The cut: the screen goes dark for a moment, the scene changes behind it, and it comes back (rule 14).
  const cutTo = (then: () => void): void => {
    setCutting(true);
    window.setTimeout(() => {
      then();
      window.setTimeout(() => setCutting(false), CUT_MS);
    }, CUT_MS);
  };
  useEffect(() => {
    if (picked?.kind === "enter") {
      setPlaceId(picked.place);
      setPicked(null);
    }
    if (picked?.kind === "inside") {
      setPicked(null);
      cutTo(() => setInside(true));
    }
    if (picked?.kind === "out") {
      setPicked(null);
      cutTo(() => setInside(false));
    }
    // The cut reads the latest state when it fires; only a new pick starts one.
  }, [picked]);
  const pins: Pin[] = (() => {
    if (!world) return [];
    const been = readKept(BEEN_KEY);
    const home = HOMES[where] ?? null;
    return places
      .filter((place) => (place.position !== null || place.id === home) && (shipped === null || shipped.has(place.id) || place.id === home))
      .map((place) => {
        const state: PinState = place.id === placeId ? "here" : place.id === home ? "home" : been.includes(place.id) ? "been" : shipped === null || shipped.has(place.id) ? "can" : "not";
        return { id: place.id, name: placeName(place.id), state, position: place.position ?? HOME_SPOT, things: place.stages.length };
      });
  })();
  // At home the map is Lagos; abroad it is the country the character is in. The rest are shut until a visa opens them.
  const countries: CountryChoice[] = [
    { id: "lagos", name: cityWords("city.map.lagos"), locked: where === "home" ? null : cityWords("city.map.not-open") },
    ...COUNTRIES.map((id) => ({ id, name: nameOf(id), locked: where === "abroad" && id === country ? null : cityWords(where === "home" ? "city.map.no-visa" : "city.map.not-open") })),
  ];
  const shownCountry = countries.find((choice) => choice.locked === null) ?? countries[0] ?? { id: "lagos", name: cityWords("city.map.lagos"), locked: null };

  const marks: Mark[] = (() => {
    if (!world || file === null) return [];
    const stage = stageOf(file);
    const found: Mark[] = [];
    for (const model of stage.models) {
      const does = actionOf(model.file);
      const key = Object.entries(THING_WORDS).find(([suffix]) => model.file.endsWith(suffix))?.[1];
      const spot = model.at[0];
      if (does === null || key === undefined || spot === undefined) continue;
      found.push({ x: spot[0], z: spot[1], text: cityWords(key), picked: does });
    }
    if (inside) found.push({ x: stage.start[0], z: stage.start[1], text: cityWords("city.thing.out"), picked: { kind: "out" } });
    return found;
  })();

  const loading = drawing && entry !== null && !ready && failed === null;
  const percent = progress === null || progress.total === 0 ? 0 : Math.floor((progress.loaded * 100) / progress.total);

  return (
    <>
      <div className={`fixed inset-0 ${looking ? "z-[35]" : "pointer-events-none -z-10"}`} data-city={placeId} data-looking={looking}>
        {drawing && entry !== null && file !== null && sample !== null ? (
          <Suspense fallback={null}>
            <CityScene
              place={placeId}
              file={file}
              people={sample.people}
              own={own}
              settings={settings}
              looking={looking}
              text={(key) => text[key]}
              onProgress={(loaded, total) => setProgress({ loaded, total })}
              onFailed={setFailed}
              onPick={setPicked}
              {...(world ? { actionOf, overview: true, zoom: inside ? Math.min(zoom, 0.2) : zoom, marks } : {})}
              onFrame={(frameMs) => {
                const next = observeFrame(watch.current, frameMs, city);
                watch.current = next;
                if (next.mode !== mode) setMode(next.mode);
              }}
            />
          </Suspense>
        ) : null}
      </div>

      {world ? <div aria-hidden className={`pointer-events-none fixed inset-0 z-[45] bg-ink transition-opacity duration-300 ${cutting ? "opacity-100" : "opacity-0"}`} data-cut={cutting} /> : null}
      {world && map ? (
        <FlyOver
          pins={pins}
          country={shownCountry}
          countries={countries}
          drawing={drawing}
          diveTo={diveTo}
          onGo={(id) => {
            setPlaceId(id);
            setMap(false);
            setDiveTo(null);
          }}
          onClose={() => {
            setMap(false);
            setDiveTo(null);
          }}
        />
      ) : null}

      {looking ? (
        <div className="pointer-events-none fixed inset-0 z-[36] flex flex-col justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {world ? (
            <div className="flex flex-col gap-2" data-hud>
              <div className="flex items-center justify-between gap-2">
                <span className="pointer-events-auto rounded-full bg-ink/60 px-3 py-1.5 text-sm font-semibold text-paper backdrop-blur-sm">{cityWords("city.hud.month", { month: view.month + 1 })}</span>
                {view.japacity.percent === null ? null : (
                  <span className="pointer-events-auto rounded-full bg-ink/60 px-3 py-1.5 text-sm font-semibold text-paper backdrop-blur-sm">
                    {words("ui.japacity.title")} <span className="text-accent">{view.japacity.percent}%</span>
                  </span>
                )}
                <span className="pointer-events-auto rounded-full bg-ink/60 px-3 py-1.5 text-sm font-semibold text-paper tabular-nums backdrop-blur-sm">{formatMoney(view.pockets.NGN.cash, "NGN")}</span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col rounded-xl bg-paper/80 px-3 py-1.5 backdrop-blur-sm">
                  <h2 className="truncate font-display text-lg leading-tight">{inside ? cityWords("city.inside.name", { place: name }) : name}</h2>
                  {inside ? (
                    <button type="button" onClick={() => cutTo(() => setInside(false))} className="self-start text-xs font-semibold text-accent underline" data-step-outside>
                      {cityWords("city.inside.out")}
                    </button>
                  ) : sample === null ? null : (
                    <p className="text-xs text-muted">{cityWords(`city.band.${sample.band}`)}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Button small onClick={() => setMenu(true)} aria-label={cityWords("city.menu")} className="bg-paper/90">
                    <Settings2 size={16} />
                  </Button>
                  <Button small onClick={() => setZoom((current) => (current > 0.3 ? ZOOM.closer : ZOOM.whole))} className="bg-paper/90" data-zoom-preset>
                    {zoom > 0.3 ? cityWords("city.zoom.closer") : cityWords("city.zoom.whole")}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper/90 p-2 backdrop-blur-sm">
              <div className="flex min-w-0 flex-1 flex-col px-1">
                <h2 className="truncate font-display text-xl leading-tight">{name}</h2>
                {sample === null ? null : <p className="text-xs text-muted">{cityWords(`city.band.${sample.band}`)}</p>}
              </div>
              <Button small onClick={() => setMenu(true)}>
                <Settings2 size={16} />
                {cityWords("city.menu")}
              </Button>
              <Button small variant="primary" onClick={() => setLooking(false)}>
                {cityWords("city.back")}
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-2 lg:max-w-md">
            {loading ? <p className="pointer-events-auto rounded-lg bg-paper/90 px-3 py-2 text-sm">{cityWords("city.loading", { place: name, percent })}</p> : null}
            {failed === null ? null : <p className="pointer-events-auto rounded-lg bg-paper/90 px-3 py-2 text-sm text-bad">{cityWords("city.failed", { place: name })}</p>}
            {scene !== null && scene.place === placeId ? (
              <div className="pointer-events-auto flex flex-col gap-2 rounded-xl border border-accent bg-surface p-4 shadow-lg" data-scene={scene.setpiece}>
                <p className="text-sm text-muted">{cityWords("city.scene.at", { place: name })}</p>
                {scene.question === null ? null : <p className="text-lg font-semibold">{words(scene.question)}</p>}
                <div>
                  <Button small variant="primary" onClick={() => setLooking(false)}>
                    {cityWords("city.scene.answer")}
                  </Button>
                </div>
              </div>
            ) : null}
            {offers.map((offer) => (
              <p key={offer} className="pointer-events-auto rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                {cityWords("city.offer.here", { offer: placeName(offer) })}
              </p>
            ))}
            {lines.length === 0 ? null : (
              <div className="pointer-events-auto flex flex-col gap-1 rounded-xl border border-line bg-surface p-3 text-sm" data-report-here>
                <p className="font-semibold">{cityWords("city.report.here")}</p>
                {lines.map((line, index) => (
                  <p key={`${line.key}-${String(index)}`}>{words(line.key, line.params)}</p>
                ))}
              </div>
            )}
            {adverts?.(placeId)}
            {heard === null ? null : (
              <p className="pointer-events-auto self-start rounded-2xl rounded-bl-sm bg-ink px-3 py-2 text-sm text-paper" data-overheard>
                {heardWords(heard.key, heard.params)}
              </p>
            )}
            {picked === null || picked.kind === "action" || picked.kind === "ride" || picked.kind === "enter" || picked.kind === "inside" ? null : <PersonCard picked={picked} words={cardWords()} onClose={() => setPicked(null)} />}
            {world ? (
              <nav aria-label={cityWords("city.menu")} className="pointer-events-auto grid grid-cols-3 gap-2" data-world-bar>
                {(
                  [
                    { id: "phone", icon: Smartphone, label: cityWords("city.phone"), onTap: () => setPhone(true), dot: view.offers.length > 0 },
                    { id: "map", icon: MapIcon, label: cityWords("city.map"), onTap: () => setMap(true), dot: false },
                    { id: "month", icon: Moon, label: cityWords("city.month"), onTap: () => setMonthOpen(true), dot: false },
                  ] as const
                ).map(({ id, icon: Icon, label, onTap, dot }) => (
                  <button key={id} type="button" onClick={onTap} data-bar={id} className="relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-ink bg-paper/95 text-xs font-bold text-ink shadow-md">
                    <Icon size={20} />
                    {label}
                    {dot ? <span className="absolute top-1.5 right-2 size-3 rounded-full bg-bad" aria-hidden /> : null}
                  </button>
                ))}
              </nav>
            ) : (
              <p className="pointer-events-auto self-start rounded-lg bg-paper/80 px-2 py-1 text-xs text-muted">{cityWords("city.hold")}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="fixed top-16 right-3 z-20 flex flex-col items-end gap-1">
          <Button small onClick={() => setLooking(true)} className="bg-surface/95 shadow-md">
            <MapIcon size={16} />
            {cityWords("city.look")}
          </Button>
          {loading ? <p className="rounded-md bg-surface/95 px-2 py-1 text-xs text-muted shadow-sm">{cityWords("city.loading", { place: name, percent })}</p> : null}
        </div>
      )}

      <Sheet open={menu} onOpenChange={setMenu} title={cityWords("city.menu")}>
        <section className="flex flex-col gap-2">
          <h3 className="font-semibold">{cityWords("city.places.title")}</h3>
          <ul className="flex flex-col gap-1" aria-label={cityWords("city.places")}>
            {places.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  aria-current={place.id === placeId ? "location" : undefined}
                  onClick={() => {
                    setPlaceId(place.id);
                    setMenu(false);
                  }}
                  className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left hover:bg-sunk ${place.id === placeId ? "font-semibold" : ""}`}
                >
                  {placeName(place.id)}
                  {place.id === placeId ? <span className="text-xs text-muted">{cityWords("city.here")}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
        <fieldset className="flex flex-col gap-2">
          <legend className="font-semibold">{cityWords("city.graphics")}</legend>
          {(["auto", "low", "high"] as const).map((option) => (
            <label key={option} className="flex min-h-11 items-center gap-3">
              <input type="radio" name="city-graphics" checked={choice === option} onChange={() => choose(option)} />
              {cityWords(`city.graphics.${option}`)}
            </label>
          ))}
          <p className="text-sm text-muted">{cityWords("city.graphics.now", { mode: cityWords(`city.mode.${mode}`) })}</p>
        </fieldset>
        <div>
          <Button
            onClick={() => {
              setMenu(false);
              setCredits(true);
            }}
          >
            {cityWords("city.credits")}
          </Button>
        </div>
      </Sheet>
      <CreditsSheet open={credits} onOpenChange={setCredits} />
      <Sheet open={picked?.kind === "action"} onOpenChange={(open) => { if (!open) setPicked(null); }} title={picked?.kind === "action" ? cardWords() : ""}>
        {picked?.kind === "action" ? actions?.([picked.activity]) : null}
      </Sheet>
      <Sheet open={world && monthOpen} onOpenChange={setMonthOpen} title={cityWords("city.month.title")} description={cityWords("city.month.hint")}>
        <ul className="flex flex-col gap-1" data-month-plan>
          {plan.filter((pick): pick is NonNullable<typeof pick> => pick !== null).map((pick, index) => (
            <li key={`${pick.activity}-${String(index)}`} className="rounded-lg bg-sunk px-3 py-2 text-sm font-semibold">
              {nameOf(pick.activity)}
            </li>
          ))}
          {plan.every((pick) => pick === null) ? <li className="rounded-lg bg-sunk px-3 py-2 text-sm text-muted">{cityWords("city.month.none")}</li> : null}
        </ul>
        {month}
      </Sheet>
      {world && phone && apps !== undefined ? <Phone apps={apps} onClose={() => setPhone(false)} /> : null}
      <Sheet open={picked?.kind === "ride"} onOpenChange={(open) => { if (!open) setPicked(null); }} title={picked?.kind === "ride" ? cardWords() : ""} description={cityWords("city.ride.title")}>
        {picked?.kind === "ride" ? (
          <ul className="flex flex-col gap-1" aria-label={cityWords("city.ride.title")} data-ride-list>
            {[...pins.filter((pin) => pin.state === "home"), ...pins.filter((pin) => pin.state !== "home" && pin.state !== "here" && pin.state !== "not")].map((pin) => {
              const here = pins.find((candidate) => candidate.state === "here");
              return (
                <li key={pin.id}>
                  <button type="button" onClick={() => travel(pin.id)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left hover:bg-sunk">
                    <span className="font-semibold">{pin.state === "home" ? cityWords("city.ride.home") : pin.name}</span>
                    <span className="text-xs text-muted">{here === undefined ? "" : cityWords("city.ride.line", { minutes: minutesBetween(here.position, pin.position) })}</span>
                  </button>
                </li>
              );
            })}
            {pins.filter((pin) => pin.state !== "here" && pin.state !== "not").length === 0 ? <li className="px-3 py-2 text-sm text-muted">{cityWords("city.ride.none")}</li> : null}
          </ul>
        ) : null}
      </Sheet>
    </>
  );
}
