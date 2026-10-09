// The city (docs/rules/city.md): a full-screen scene under the panels, brought in front of them by
// "Look around". It reads the view and never changes it: entering a place, walking and tapping are
// this screen's own state, and nothing here sends a command (R-CITY-001). The 3D scene is loaded
// only where WebGL exists, so the panels never wait for it (R-CITY-018).
import { content, text } from "@japacity/content";
import type { Id, PlaceEntry } from "@japacity/sim";
import { Map as MapIcon, Settings2, X } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { chooseGraphics, setGraphicsMode } from "../../shared/graphics/mode";
import { assetUrl, loadJson, loadManifest } from "../../shared/three/manifest";
import { Button } from "../../shared/ui/Button";
import { Sheet } from "../../shared/ui/Sheet";
import { formatMoney } from "../../shared/words/format";
import { blurbOf, nameOf, say, words } from "../../shared/words/text";
import { AskSheet } from "../../shared/world/AskSheet";
import { Band } from "../../shared/world/Band";
import { cue } from "../../shared/sound/cues";
import type { Ask, RideChoice } from "../../shared/world/contract";
import { Cut, useCut } from "../../shared/world/Cut";
import { Nudge } from "../../shared/world/Nudge";
import { ThumbBar } from "../../shared/world/ThumbBar";
import { Toast, useToast } from "../../shared/world/Toast";
import { WorldSheet } from "../../shared/world/WorldSheet";
import { cityWords, heardWords, placeName, residentName, roleWords } from "./city.words";
import { CreditsSheet } from "./Credits";
import { type CountryChoice, FlyOver, flyoverOn, type Pin, type PinState } from "./FlyOver";
import { crowdTuning } from "./limits";
import { Phone, type PhoneApp } from "./Phone";
import { localDate, type Other, poolOf, sampleCrowd } from "./crowd";
import { nudgeOf } from "./nudge";
import { type Device, enterPlace, keepChoice, type Mode, type ModeChoice, modeSettings, observeFrame, readChoice, startingMode, watchFrames } from "./mode";
import { overheard } from "./overheard";
import { dancerShown, dressPlace, openGround, type PlaceFile, stageOf } from "./placeFile";
import { HOUSE, insideOf, roomOf } from "./room";
import { personOfLook } from "./roster";
import type { Picked, ScenePick } from "./scene.types";
import { sceneWords } from "./scene.words";
import { enterable, offersHere, openingPlace, openScene, reportHere, type ViewPlace } from "./staging";
import { thingsNow, thingsOf, vehicleOf } from "./things";

const CityScene = lazy(() => import("./CityScene"));

const city = content.tuning.city;
const PLACES = Object.values(content.place);
/** How long a line overheard stays before the next is heard. */
const HEARD_MS = 9000;
const FALLBACK_OWN = "shared/chr/chr_tunde.glb";

// The world mode (docs/design/11-the-world-first.md), a prototype the maintainer judges before it becomes rules.
const LAST_KEY = "japacity.city.last";
const BEEN_KEY = "japacity.city.been";
/** Minutes by road between two places, from their positions: a base wait and a Lagos pace. */
function minutesBetween(from: { latE3: number; lonE3: number }, to: { latE3: number; lonE3: number }): number {
  const cos = Math.cos((from.latE3 / 1000) * (Math.PI / 180));
  const metres = Math.hypot((to.lonE3 - from.lonE3) * 111.32 * cos, (to.latE3 - from.latE3) * 111.32);
  return 8 + Math.round(metres / 120);
}
// tuning.city.roam is the maintainer's to add; until it is there, nothing roams.
/** The street camera, the hold-to-plan view, routed walks and strolling people, switched off (world.md R-WORLD-010). */
const ROAM = (city as Partial<Record<"roam", boolean>>).roam ?? false;
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

/** A room's file by its folder under places/, fetched when the place outside it is entered (R-WORLD-013); null while unknown or missing. */
function useRoomFile(folder: string | null, drawing: boolean): PlaceFile | null {
  const [file, setFile] = useState<{ folder: string; file: PlaceFile } | null>(null);
  useEffect(() => {
    if (folder === null || !drawing) return;
    let alive = true;
    void loadManifest()
      .then((manifest) => loadJson<PlaceFile>(manifest, `places/${folder}/place.json`))
      .catch(() => null)
      .then((found) => {
        if (alive && found !== null) setFile({ folder, file: found });
      });
    return () => {
      alive = false;
    };
  }, [folder, drawing]);
  return file !== null && file.folder === folder ? file.file : null;
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
/** What the city hands its map: the same as the fly-over took. */
export interface CityMapSlot {
  pins: readonly Pin[];
  country: CountryChoice;
  countries: readonly CountryChoice[];
  drawing: boolean;
  diveTo: string | null;
  onGo: (id: string) => void;
  onClose: () => void;
  /** The home of the country shown, so it stays a house when the player stands there. */
  home: string | null;
  /** A way chosen: the fare goes through `place/ride`, and the answer says whether the ride plays (R-PLACE-010). */
  onRide?: (choice: RideChoice, to: string) => Promise<boolean>;
}

export function City({
  adverts,
  world = false,
  actions,
  month,
  apps,
  results,
  asks,
  phone: handset,
  phoneWaiting,
  cityMap,
}: {
  adverts?: (place: string) => ReactNode;
  /** The world mode: the place fills the screen under a see-through bar, with the fly-over as its map. */
  world?: boolean;
  /** The world mode's sheet for the actions a tapped thing stages. */
  actions?: (ids: string[]) => ReactNode;
  /** The world mode's month control, shown in the Month sheet. */
  month?: ReactNode;
  /** The world mode's phone: the support pages as apps (section 2b). Retired: `phone` replaces it. */
  apps?: readonly PhoneApp[];
  /** The world mode's results sheet when a month ends (R-WORLD-008), given the name of where the player is. */
  results?: (place: string) => ReactNode;
  /** The world mode's sheet for what the nudge names and waits on the player: the set piece's question, the offers (R-WORLD-003). */
  asks?: ReactNode;
  /** The world mode's phone (R-WORLD-018), handed in by the shell: the handset over the place named `area`. */
  phone?: (close: () => void, area: string) => ReactNode;
  /** A dot on the Phone button: an app has something new (R-WORLD-004). */
  phoneWaiting?: boolean;
  /** The world mode's map (R-WORLD-015 to 017), handed in by the shell; the fly-over stands in without it. */
  cityMap?: (props: CityMapSlot) => ReactNode;
} = {}) {
  const view = useView();
  const send = useGame((state) => state.send);
  const presence = useGame((state) => (state as { presence?: PresenceSample | null }).presence ?? null);
  const drawing = useMemo(canDraw, []);
  const [date] = useState(() => localDate(new Date()));
  const [looking, setLooking] = useState(world);
  const [map, setMap] = useState(false);
  const [inside, setInside] = useState(false);
  const { cutting, cutTo } = useCut();
  const toast = useToast();
  const addToPlan = useGame((state) => state.addToPlan);
  const [phone, setPhone] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  // R-WORLD-002: the band's clock is the character's age with the turns left beside it; the simulation still counts months.
  const ageMonths = view.qualities.find((quality) => quality.id === "quality.age-months")?.value ?? 0;
  const clock = say("ui.world.clock", { years: Math.floor(ageMonths / 12), months: ageMonths % 12, turns: view.turns.banked });
  const [asksOpen, setAsksOpen] = useState(false);
  // R-WORLD-008: the results are up from the month's end until the player goes back to the place; the staged wins come first.
  const resultsOpen = useGame((state) => state.reportOpen && state.moments.length === 0) && world && view.report !== null;
  const reportOpen = useGame((state) => state.reportOpen);
  const [zoomed, setZoomed] = useState(false);
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
    setZoomed(false);
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
  // Inside, the scene is the room the place's door opens into: the file's `inside` names its folder under
  // places/, fetched with the place so the cut is quick (R-WORLD-013); the room's own file names the entry
  // it belongs to (the hub's room is place.yaba, the parlour the family house). A place that names no room
  // has one cut from its own file.
  const insideId = insideOf(outsideFile);
  const insideFile = useRoomFile(insideId, drawing);
  const insideEntry = insideId === null ? null : (entryOf(insideFile?.place ?? "") ?? PLACES.find((place) => place.assets === insideId) ?? entryOf(insideId) ?? entry);
  const file = useMemo(() => (outsideFile === null || !inside ? outsideFile : insideId === null ? roomOf(outsideFile, HOUSE) : insideFile), [outsideFile, inside, insideId, insideFile]);
  useEffect(() => {
    setZoomed(false);
    setPicked(null);
  }, [inside]);
  const settings = modeSettings(mode, device(), city);
  const others = useMemo<Other[]>(() => (presence !== null && presence.place === placeId ? presence.others : []), [presence, placeId]);
  const today = useMemo<Other[]>(() => (presence !== null && presence.place === placeId ? (presence.today ?? []) : []), [presence, placeId]);
  const own = ownFile(view.scenario);
  // No resident wears the player's own outfit or a dancer's.
  // In the world a place shows at most the crowd its scope allows in the mode; the party keeps its ten (R-WORLD-011).
  const crowdEntry = inside && insideEntry !== null ? insideEntry : entry;
  const dressedCrowd = inside ? null : (dressed?.crowd ?? null);
  const sample = useMemo(
    () =>
      crowdEntry === null || file === null
        ? null
        : sampleCrowd({ ...crowdEntry, crowd: dressedCrowd ?? crowdEntry.crowd }, poolOf(file.people.sample), date, mode, world ? crowdTuning(city, file.scope, dressedCrowd !== null) : city, others, today, [own, ...(stageOf(file).dancers ?? []).map((dancer) => dancer.file)]),
    [crowdEntry, file, dressedCrowd, date, mode, others, today, own, world],
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
      case "thing":
        return sceneWords(picked.thing.label);
      default: {
        const never: never = picked;
        throw new Error(`Unknown pick: ${JSON.stringify(never)}`);
      }
    }
  };

  // The things here and the acts the view allows now: an activity's act only while the view offers it here (R-WORLD-005).
  const activityKey = view.activities.map((option) => option.id).join("|");
  const things = useMemo(() => {
    if (!world || file === null) return undefined;
    const offered = new Set(activityKey.split("|"));
    const staged = new Set<string>([...(entry?.stages ?? []), ...(insideEntry?.stages ?? [])]);
    return thingsNow(thingsOf(stageOf(file)), (stages) => !stages.startsWith("activity.") || (offered.has(stages) && staged.has(stages)));
  }, [world, file, activityKey, entry, insideEntry]);
  // What the scene reports: a thing chosen shows its acts; an act becomes the sheet, the ride, the cut in or the cut out it stands for.
  // An act lands once the character has walked to its thing (R-WORLD-010); one that lands under a sheet, the phone, the map or the results is dropped.
  const readPick = (scenePick: ScenePick): void => {
    if (scenePick.kind !== "act") {
      setPicked(scenePick);
      return;
    }
    if (monthOpen || asksOpen || phone || map || resultsOpen) {
      setPicked(null);
      return;
    }
    const { thing, act } = scenePick;
    switch (act.kind) {
      case "sheet":
        setPicked(act.stages === undefined ? null : { kind: "action", activity: act.stages });
        return;
      case "ride":
        setPicked({ kind: "ride", vehicle: vehicleOf(thing) ?? "danfo" });
        return;
      case "enter":
        setPicked({ kind: "inside" });
        return;
      case "out":
        setPicked({ kind: "out" });
        return;
      // R-WORLD-025: the bed's End month is the band's, so the Month sheet opens the same way.
      case "end":
        setPicked(null);
        setMonthOpen(true);
        return;
      case "plain":
        setPicked(null);
        toast.show(sceneWords(act.label));
        return;
      default: {
        const never: never = act.kind;
        throw new Error(`Unknown act: ${String(never)}`);
      }
    }
  };
  // A ride plays as the fly-over's dive, then the place opens (rule 13).
  const travel = (id: string): void => {
    cue("whoosh");
    setPicked(null);
    setDiveTo(id);
    setMap(true);
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

  const nudge = world ? nudgeOf(view) : null;
  // A question or an offer waiting on the player opens from the nudge; nothing else is on screen to open it (R-WORLD-001).
  const nudgeOpens = asks !== undefined && (nudge?.about === "setpiece" || nudge?.about === "offer");
  const endBlocked = view.ended ? words("reject.ended") : view.setpiece !== null || (view.interview?.question ?? null) !== null ? words("reject.setpiece-open") : view.turns.banked < 1 ? words("reject.no-turns") : null;
  // One action, one sheet: a paper slip for a paper thing, a card for the rest.
  const ask: Ask | null = (() => {
    if (!world || picked?.kind !== "action") return null;
    const activity = picked.activity;
    const option = view.activities.find((candidate) => candidate.id === activity);
    if (option === undefined) return null;
    const cost = option.cost[0] ?? null;
    const paper = activity === "activity.play-lotto" || activity === "activity.bet-slip";
    return {
      form: paper ? "slip" : "card",
      icon: paper ? "ticket" : "hand",
      who: name,
      title: nameOf(activity),
      line: blurbOf(activity) ?? "",
      cost: cost === null ? null : { amount: cost.amount, currency: cost.currency },
      button: say("ui.activity.add"),
      ...(paper ? { reference: say("ui.world.month-of", { month: view.month + 1 }).toUpperCase() } : {}),
      act: () => {
        const added = addToPlan({ activity: option.id, param: option.params?.[0] ?? null });
        cue(added ? (cost === null ? "done" : "coin") : "tap");
        setPicked(null);
        toast.show(say(added ? "ui.world.added" : "ui.world.full"));
      },
      dismiss: () => setPicked(null),
    };
  })();

  // The Month sheet gives way to the results when the month ends; the asks sheet closes once nothing waits.
  useEffect(() => {
    if (reportOpen) setMonthOpen(false);
  }, [reportOpen]);
  useEffect(() => {
    if (!nudgeOpens) setAsksOpen(false);
  }, [nudgeOpens]);
  // R-WORLD-022: a sheet, the phone or the map opening over the world, and closing back to it.
  const covered = world && (monthOpen || asksOpen || ask !== null || picked?.kind === "ride" || phone || map);
  const wasCovered = useRef(covered);
  useEffect(() => {
    if (covered === wasCovered.current) return;
    wasCovered.current = covered;
    cue(covered ? "open" : "close");
  }, [covered]);

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
              looking={looking && !map}
              text={(key) => text[key]}
              onProgress={(loaded, total) => setProgress({ loaded, total })}
              onFailed={setFailed}
              onPick={readPick}
              {...(world ? { overview: true, roam: ROAM, ...(things === undefined ? {} : { things }), chosen: picked?.kind === "thing" ? picked.thing : null, onClear: () => setPicked(null), zoomed, onZoomed: setZoomed } : {})}
              onFrame={(frameMs) => {
                const next = observeFrame(watch.current, frameMs, city);
                watch.current = next;
                if (next.mode !== mode) setMode(next.mode);
              }}
            />
          </Suspense>
        ) : null}
      </div>

      {world && map && cityMap !== undefined && !flyoverOn()
        ? cityMap({
            pins,
            country: shownCountry,
            countries,
            drawing,
            diveTo,
            home: HOMES[where] ?? null,
            onGo: (id) => {
              setPlaceId(id);
              setMap(false);
              setDiveTo(null);
              toast.show(placeName(id));
            },
            onClose: () => {
              setMap(false);
              setDiveTo(null);
            },
            // R-PLACE-010: the fare leaves cash through the command, and the ride plays only once it is
            // accepted; abroad the map asks no fare (decision 0011).
            onRide: async (choice, to) => {
              if (view.place.where !== "home") return true;
              const reply = await send({ type: "place/ride", from: placeId as Id<"place">, to: to as Id<"place">, way: choice.id });
              return reply?.ok === true;
            },
          })
        : null}
      {world && map && (cityMap === undefined || flyoverOn()) ? (
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

      {world && looking ? (
        <>
          <Band
            when={clock}
            name={inside ? cityWords("city.inside.name", { place: name }) : name}
            money={view.pockets.NGN.cash}
            formatMoney={(amount) => formatMoney(amount, "NGN")}
            onEndMonth={() => setMonthOpen(true)}
            endBlocked={endBlocked}
            hidden={map || resultsOpen}
            aside={
              inside ? (
                <button type="button" onClick={() => cutTo(() => setInside(false))} className="label-strong self-start text-[11px] font-bold underline" data-step-outside>
                  {say("ui.world.step-outside")}
                </button>
              ) : null
            }
          />
          <Nudge nudge={nudge} hidden={map || phone || monthOpen || asksOpen || menu || credits || resultsOpen || picked !== null} {...(nudgeOpens ? { onTap: () => setAsksOpen(true) } : {})} />
          <ThumbBar onMap={() => setMap(true)} onPhone={() => setPhone(true)} phoneWaiting={phoneWaiting ?? view.offers.length > 0} hidden={map || resultsOpen} />
          {zoomed && !map ? (
            <button type="button" onClick={() => setZoomed(false)} className="chip drop pointer-events-auto fixed bottom-[calc(max(14px,env(safe-area-inset-bottom))+76px)] left-1/2 z-[38] -translate-x-1/2 px-3 py-2 text-[13px] font-bold" data-zoom-preset>
              {say("ui.world.whole")}
            </button>
          ) : null}
          <Toast words={toast.words} />
          <Cut cutting={cutting} />
        </>
      ) : null}
      {looking ? (
        <div className="pointer-events-none fixed inset-0 z-[36] flex flex-col justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {world ? null : (
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
            {/* In the world only the band, the nudge and the two thumb buttons stand over the place (R-WORLD-001): the question, the offers and the month's lines open from the nudge, the results and the phone. */}
            {!world && scene !== null && scene.place === placeId ? (
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
            {(world ? [] : offers).map((offer) => (
              <p key={offer} className="pointer-events-auto rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                {cityWords("city.offer.here", { offer: placeName(offer) })}
              </p>
            ))}
            {world || lines.length === 0 ? null : (
              <div className="pointer-events-auto flex flex-col gap-1 rounded-xl border border-line bg-surface p-3 text-sm" data-report-here>
                <p className="font-semibold">{cityWords("city.report.here")}</p>
                {lines.map((line, index) => (
                  <p key={`${line.key}-${String(index)}`}>{words(line.key, line.params)}</p>
                ))}
              </div>
            )}
            {world ? null : adverts?.(placeId)}
            {world || heard === null ? null : (
              <p className="pointer-events-auto self-start rounded-2xl rounded-bl-sm bg-ink px-3 py-2 text-sm text-paper" data-overheard>
                {heardWords(heard.key, heard.params)}
              </p>
            )}
            {picked === null || picked.kind === "action" || picked.kind === "ride" || picked.kind === "enter" || picked.kind === "inside" || picked.kind === "thing" ? null : <PersonCard picked={picked} words={cardWords()} onClose={() => setPicked(null)} />}
            {world ? null : (
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
      {world ? <AskSheet ask={ask} have={view.pockets.NGN.cash} formatMoney={(amount, currency) => formatMoney(amount, currency as "NGN")} /> : null}
      <Sheet open={!world && picked?.kind === "action"} onOpenChange={(open) => { if (!open) setPicked(null); }} title={picked?.kind === "action" ? cardWords() : ""}>
        {picked?.kind === "action" ? actions?.([picked.activity]) : null}
      </Sheet>
      {world ? (
        <WorldSheet open={monthOpen} onClose={() => setMonthOpen(false)} label={clock} title={cityWords("city.month.title")} mark="month">
          {month}
        </WorldSheet>
      ) : null}
      {world && asks !== undefined ? (
        <WorldSheet open={asksOpen} onClose={() => setAsksOpen(false)} label={name} title={say(nudge?.key ?? "ui.nudge.end")} mark="asks">
          {asks}
        </WorldSheet>
      ) : null}
      {world ? results?.(inside ? cityWords("city.inside.name", { place: name }) : name) : null}
      {world && phone && handset !== undefined ? handset(() => setPhone(false), inside ? cityWords("city.inside.name", { place: name }) : name) : null}
      {world && phone && handset === undefined && apps !== undefined ? <Phone apps={apps} onClose={() => setPhone(false)} /> : null}
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
