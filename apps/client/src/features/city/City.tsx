// The city (docs/rules/city.md): a full-screen scene under the panels, brought in front of them by
// "Look around". It reads the view and never changes it: entering a place, walking and tapping are
// this screen's own state, and nothing here sends a command (R-CITY-001). The 3D scene is loaded
// only where WebGL exists, so the panels never wait for it (R-CITY-018).
import { content, text } from "@japacity/content";
import type { Id, PlaceEntry, PlayerView, ReportLine } from "@japacity/sim";
import { Clock, Map as MapIcon, Settings2, X } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { chooseGraphics, setGraphicsMode } from "../../shared/graphics/mode";
import { assetUrl, loadJson, loadManifest } from "../../shared/three/manifest";
import { Button } from "../../shared/ui/Button";
import { FullScreen } from "../../shared/ui/FullScreen";
import { Sheet } from "../../shared/ui/Sheet";
import { formatMoney } from "../../shared/words/format";
import { jobCardWords } from "../../shared/words/jobs";
import { needsWords } from "../../shared/words/requirement";
import { sixteenPath } from "../../shared/words/sixteen";
import { blurbOf, hasWords, inMonths, nameOf, paramWords, say, words } from "../../shared/words/text";
import { ENGLISH_TEST, testChance } from "../../shared/words/test";
import { AskSheet } from "../../shared/world/AskSheet";
import { Band, bandMoney } from "../../shared/world/Band";
import { cue } from "../../shared/sound/cues";
import type { Ask, RideChoice } from "../../shared/world/contract";
import { Cut, useCut } from "../../shared/world/Cut";
import { Nudge } from "../../shared/world/Nudge";
import { ThumbBar } from "../../shared/world/ThumbBar";
import { Toast, useToast } from "../../shared/world/Toast";
import { WorldSheet } from "../../shared/world/WorldSheet";
import { cityWords, heardWords, papersLook, placeName, residentName, roleWords } from "./city.words";
import { CreditsSheet } from "./Credits";
import { type CountryChoice, FlyOver, flyoverOn, type Pin, type PinState } from "./FlyOver";
import { crowdTuning } from "./limits";
import { Phone, type PhoneApp } from "./Phone";
import { localDate, type Other, poolOf, sampleCrowd } from "./crowd";
import { BOARD_WAY, nudgeOf, stepThingHere, stepWayOf } from "./nudge";
import { nudgeHere, stepOpen } from "./stepOpen";
import { StillWaiting, stillWaiting } from "./StillWaiting";
import { type Device, enterPlace, keepChoice, type Mode, type ModeChoice, modeSettings, observeFrame, readChoice, startingMode, watchFrames } from "./mode";
import { overheard } from "./overheard";
import { dancerShown, dressPlace, openGround, type PlaceFile, stageOf } from "./placeFile";
import { HOUSE, insideOf, roomOf } from "./room";
import { personOfLook } from "./roster";
import type { Picked, ScenePick } from "./scene.types";
import { sceneWords } from "./scene.words";
import { enterable, offersHere, openingPlace, openScene, reportHere, type ViewPlace } from "./staging";
import { stagedNow, thingsNow, thingsOf, vehicleOf } from "./things";
import { stopReached } from "./stops";

/** Nudges that name a wait with nothing to do but end months: the English result on its way. */
const WAIT_ONLY: ReadonlySet<string> = new Set(["chapter.build-the-file.item.english.started"]);

const CityScene = lazy(() => import("./CityScene"));

const city = content.tuning.city;
const PLACES = Object.values(content.place);
/** How long a line overheard stays before the next is heard. */
const HEARD_MS = 9000;
const FALLBACK_OWN = "shared/chr/chr_tunde.glb";

// The world mode (docs/design/11-the-world-first.md), a prototype the maintainer judges before it becomes rules.
const LAST_KEY = "japacity.city.last";
const BEEN_KEY = "japacity.city.been";
/** Sending money home: an act whose sheet is the Bank's, where the money is. */
const SEND_MONEY = "activity.send-money";
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
/**
 * The places whose files are the old page's, kept switched off (R-WORLD-024) until each is rebuilt
 * as a world-first place: the map shows only built places, and nothing with nothing to do (PENDING P25).
 */
const OLD_FILES = new Set<string>();

/**
 * The first chapter's opening words for this life (R-WORLD-001): the
 * scenario's own line when content has one, the prologue's by its path (a degree or a trade), else the
 * chapter's line.
 */
function openingKey(view: Pick<PlayerView, "chapter" | "scenario" | "qualities" | "pockets">): string {
  const chapter = view.chapter.current ?? "";
  const slug = view.scenario.replace(/^scenario\./, "");
  if (slug === "prologue") {
    // The path the prologue built: a degree, a trade, or a trade with the master's settlement in hand.
    const path = `${chapter}.open.prologue.${sixteenPath(view) ?? "trade"}`;
    if (hasWords(path)) return path;
  } else if (hasWords(`${chapter}.open.${slug}`)) return `${chapter}.open.${slug}`;
  return `${chapter}.open`;
}
/** A room that is a place of its own on the map, and the street its door opens onto: the hub's file names it as its inside (R-WORLD-013). */
const OUTSIDE_OF: Record<string, string> = { "place.yaba": "place.ojuelegba" };
/** How long a big line stays as a toast before the next, since the world shows no moment cards (R-WORLD-008). */
const MOMENT_MS = 2600;
/** Home's send-off, and the party set its yard is dressed with once the party is the answer (R-CHAPTER-008). */
const SEND_OFF = "offer.family-send-off";
/** The family house's one party set and its guests, which its file keys to a party offer (R-CITY-011). */
const PARTY_SET = "offer.send-off-party";
/** The party's own line, told over the full yard. */
const PARTY_SAID = `${SEND_OFF}.said.party`;
/** How long the party's line stands over the yard: long enough to read it, then the yard is the player's again. */
export const PARTY_BEAT_MS = 6000;

/** True when this month's answers include home's send-off as the party. */
export function partyThrown(lines: readonly ReportLine[]): boolean {
  return lines.some((line) => line.key === "line.offer.taken" && line.params.offer === SEND_OFF && line.params.choice === "party");
}

/**
 * What dresses the place: the open offers it stages, and once the party was the answer this month the
 * party set and its guests, kept until the month ends.
 */
export function dressedBy(open: readonly string[], lines: readonly ReportLine[]): string[] {
  return partyThrown(lines) && !open.includes(PARTY_SET) ? [...open, PARTY_SET] : [...open];
}

/** How long the band's second row peeks after its words change (from the design's bar). */
const PEEK_MS = 5000;

/** What is coming soonest with a month to it: an offer's deadline, a paper's ready month, a visa decision (R-WORLD-002). */
function soonest(view: PlayerView): { what: string; month: number } | null {
  const coming: { what: string; month: number }[] = [];
  for (const offer of view.offers) coming.push({ what: words(`${offer.entry}.name`), month: offer.expiresMonth });
  for (const paper of view.documents) if (paper.state === "pending" && paper.readyMonth !== null) coming.push({ what: nameOf(paper.id), month: paper.readyMonth });
  for (const route of view.routes) if (route.visa !== null && (route.state === "applying" || route.state === "known")) coming.push({ what: nameOf(route.id), month: route.visa.decisionMonth });
  return coming.filter((item) => item.month >= view.month).sort((a, b) => a.month - b.month)[0] ?? null;
}

/** The middle of an area's positioned places, for a built place that content gives no position of its own. */
function areaSpot(area: string): { latE3: number; lonE3: number } | null {
  const spots = PLACES.filter((place) => place.area === area && place.position !== null).map((place) => place.position as { latE3: number; lonE3: number });
  if (spots.length === 0) return null;
  return { latE3: Math.round(spots.reduce((sum, spot) => sum + spot.latE3, 0) / spots.length), lonE3: Math.round(spots.reduce((sum, spot) => sum + spot.lonE3, 0) / spots.length) };
}
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
    <div role="dialog" aria-label={said} className="pointer-events-auto flex items-start gap-3 rounded-xl border border-sheet-line bg-sheet-2 p-4 shadow-lg" data-card={picked.kind}>
      <p className="flex-1">{said}</p>
      <button type="button" aria-label={cityWords("city.close")} onClick={onClose} className="inline-flex size-9 items-center justify-center rounded-lg border border-sheet-line">
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
  /** The way to choose first on the ride sheet: the vehicle tapped in the place (R-WORLD-017). */
  by?: RideChoice["id"];
  /** A stop to open picked: the nudge's step elsewhere (R-WORLD-003). */
  pickFirst?: string | null;
}

export function City({
  adverts,
  world = false,
  actions,
  month,
  apps,
  results,
  asks,
  asksAt,
  asksHold,
  phone: handset,
  phoneWaiting,
  askIcon,
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
  /** The world mode's sheet for what the nudge names and waits on the player: the set piece's question, the offers (R-WORLD-003). A list shows one at a time, with Next (R-WORLD-006). */
  asks?: ReactNode | ReactNode[];
  /** For each ask, the place it must be answered at, or null: away from it the sheet shows who waits and a way there (R-WORLD-006). */
  asksAt?: (string | null)[];
  /** True while an ask still says its last line after what it asked has closed (the officer's close): the sheet that holds it stays open. */
  asksHold?: boolean;
  /** The world mode's phone (R-WORLD-018), handed in by the shell: the handset over the place named `area`. */
  phone?: (close: () => void, area: string, app?: string | null) => ReactNode;
  /** A dot on the Phone button: an app has something new (R-WORLD-004). */
  phoneWaiting?: boolean;
  /** The icon for an ask card's corner, by the ask's icon name, from the shell's icon set. */
  askIcon?: (name: string) => ReactNode;
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
  const [inside, setInside] = useState(() => world && readKept(LAST_KEY)[1] === "inside");
  const { cutting, cutTo } = useCut();
  const toast = useToast();
  const addToPlan = useGame((state) => state.addToPlan);
  const plan = useGame((state) => state.plan);
  const [phone, setPhone] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  // R-WORLD-002: the band's clock is the character's age with the turns left beside it; the simulation still counts months.
  const ageMonths = view.qualities.find((quality) => quality.id === "quality.age-months")?.value ?? 0;
  const clock = say("ui.world.clock", { years: Math.floor(ageMonths / 12), months: ageMonths % 12 });
  const [asksOpen, setAsksOpen] = useState(false);
  const [askIndex, setAskIndex] = useState(0);
  const askList = Array.isArray(asks) ? asks : null;
  const askCount = askList?.length ?? 0;
  useEffect(() => {
    if (askIndex >= askCount) setAskIndex(0);
  }, [askIndex, askCount]);
  // R-WORLD-008: the results are up from the month's end until the player goes back to the place; the staged wins come first.
  const resultsOpen = useGame((state) => state.reportOpen && state.moments.length === 0) && world && view.report !== null;
  const reportOpen = useGame((state) => state.reportOpen);
  // R-WORLD-008: the old page's moment cards are not shown over the world; a big line (the flight, a win) is said as a toast and passes.
  const moments = useGame((state) => state.moments);
  const nextMoment = useGame((state) => state.nextMoment);
  useEffect(() => {
    if (!world || moments.length === 0) return;
    const line = moments[0];
    // The party's line is told by its own beat over the full yard, not as a passing toast.
    if (line !== undefined && line.key !== PARTY_SAID) toast.show(words(line.key, line.params));
    const timer = window.setTimeout(nextMoment, MOMENT_MS);
    return () => window.clearTimeout(timer);
    // The toast is the city's; a new first line shows once the last has passed.
  }, [world, moments, nextMoment]);
  // R-WORLD-025: the scene goes dark, then the results sheet (which reads the report's state itself).
  const [resultsShown, setResultsShown] = useState(false);
  useEffect(() => {
    if (world && reportOpen) cutTo(() => setResultsShown(true));
    else setResultsShown(false);
    // The cut runs once as the report opens.
  }, [world, reportOpen]);
  const [zoomed, setZoomed] = useState(false);
  const [diveTo, setDiveTo] = useState<string | null>(null);
  // The stop the map opens on when the nudge sends the player somewhere (R-WORLD-003).
  const [mapPick, setMapPick] = useState<string | null>(null);
  // The chapter's opening words stand over the world once, before the first month is played (R-WORLD-001).
  const [openingSeen, setOpeningSeen] = useState(false);
  // The app the phone opens on when the nudge sends the player to it (the month's news).
  const [phoneApp, setPhoneApp] = useState<string | null>(null);
  /** The way a vehicle in the place was tapped for, chosen on the ride sheet when the map opens from it (R-WORLD-017). */
  const [rideBy, setRideBy] = useState<RideChoice["id"] | null>(null);
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
  useEffect(() => {
    if (!world || !drawing) return;
    let alive = true;
    void loadManifest()
      .then((manifest) => {
        if (alive) setShipped(new Set(PLACES.filter((place) => !OLD_FILES.has(place.id) && assetUrl(manifest, `places/${place.assets}/place.json`) !== null).map((place) => place.id)));
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
  const monthLines = useGame((state) => state.monthLines);
  const partied = world && partyThrown(monthLines);
  const openKey = dressedBy(offers, partied ? monthLines : []).join("|");
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
  // The world mode remembers where the player stopped and where they have been (rules 5 and 7).
  useEffect(() => {
    if (!world) return;
    keep(LAST_KEY, inside ? [placeId, "inside"] : [placeId]);
    const been = readKept(BEEN_KEY);
    const here = inside && insideEntry !== null ? [placeId, insideEntry.id] : [placeId];
    const fresh = here.filter((id) => !been.includes(id));
    if (fresh.length > 0) keep(BEEN_KEY, [...been, ...fresh]);
  }, [world, placeId, inside, insideEntry]);
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
  // The place's name, and inside a room that is another entry's (the hub's room is place.yaba) that entry's own name.
  const name = entry === null ? "" : placeName(entry.id);
  const hereName = (inside && insideEntry?.id === "place.yaba") || placeId === "place.yaba" ? say("ui.inside.hub") : inside && insideEntry !== null && insideEntry.id !== entry?.id ? placeName(insideEntry.id) : inside ? cityWords("city.inside.name", { place: name }) : name;

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
        return picked.label === undefined ? nameOf(picked.activity) : sceneWords(picked.label);
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
      case "command":
        return say(picked.command === "route/depart" ? "ui.route.depart" : picked.command === "obligation/pay" ? "ui.world.pay-back" : "ui.route.pay-deposit");
      default: {
        const never: never = picked;
        throw new Error(`Unknown pick: ${JSON.stringify(never)}`);
      }
    }
  };

  // The things here and the acts the view allows now: an activity's act only while the view offers it here (R-WORLD-005).
  // A school's offer waiting makes the deposit payable (R-ROUTE-008): the bank's act shows while one does.
  const depositDue = view.routes.filter((route) => route.school === null && route.depositPaid === 0).flatMap((route) => route.schools.filter((school) => school.state === "offer").map((school) => ({ route: route.id, school: school.id })))[0] ?? null;
  // A visa granted makes the flight boardable at the airport's gate (R-CHAPTER-006, route/depart).
  const departDue = view.routes.find((route) => route.state === "granted")?.id ?? null;
  // R-WORLD-005: a job on a place's board or stall is an act whenever the hunt can ask for it.
  const hunt = view.activities.find((option) => option.id === "activity.job-hunt");
  // The board stays while a job is held: the hunt's jobs show, and the card says why it is shut.
  const jobIds = hunt?.params ?? [];
  // Held funds still open are paid back at the counter through a command act (R-ROUTE-008).
  const heldDue = view.obligations.find((owed) => content.obligation[owed.entry]?.type === "held-funds") ?? null;
  // An activity shut only by a paper not yet held (the English test before the passport) still stands in the world, shut with its reason.
  const paperShut = view.activities.filter((option) => !option.allowed && option.missing.length > 0 && option.missing.every((need) => need.type === "document/held")).map((option) => option.id);
  const activityKey = [...view.activities.filter((option) => option.allowed).map((option) => option.id), ...paperShut, ...(hunt === undefined ? [] : [hunt.id]), ...jobIds, ...(heldDue === null ? [] : ["command:obligation/pay"]), ...(depositDue === null ? [] : ["command:route/pay-deposit"]), ...(departDue === null ? [] : ["command:route/depart"])].join("|");
  const chapterNow = view.chapter.current;
  const offersKey = view.offers.map((offer) => offer.entry).join("|");
  const setpieceEntry = view.setpiece?.entry ?? null;
  const things = useMemo(() => {
    if (!world || file === null) return undefined;
    const offered = new Set(activityKey.split("|"));
    const staged = new Set<string>([...(entry?.stages ?? []), ...(insideEntry?.stages ?? [])]);
    return thingsNow(thingsOf(stageOf(file)), stagedNow(offered, staged, new Set(offersKey.split("|")), setpieceEntry, chapterNow));
  }, [world, file, activityKey, entry, insideEntry, offersKey, setpieceEntry, chapterNow]);
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
        // Money is sent home from the Bank's send chooser, which shows the channels, the rate and what lands.
        if (act.stages === SEND_MONEY) {
          setPicked(null);
          setPhoneApp("bank:send");
          setPhone(true);
          return;
        }
        // A job's act opens the hunt's card with that job chosen (R-WORLD-005).
        if (act.stages !== undefined && jobIds.includes(act.stages)) {
          setPicked({ kind: "action", activity: "activity.job-hunt", param: act.stages });
          return;
        }
        setPicked(act.stages === undefined ? null : { kind: "action", activity: act.stages, ...(act.more === undefined ? {} : { more: act.more, label: act.label }) });
        return;
      case "ride": {
        // R-WORLD-017: the vehicle's act opens the same ride sheet as the map, with its way chosen.
        const vehicle = vehicleOf(thing) ?? "danfo";
        setPicked(null);
        setRideBy(vehicle === "keke" || vehicle === "okada" ? vehicle : "danfo");
        setMap(true);
        return;
      }
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
      case "plain": {
        setPicked(null);
        // What the act did, in a line of its own when content has one; else its name. The papers box says what it holds (R-WORLD-019).
        const done = act.label === "city.act.papers" ? papersLook(view.documents) : sceneWords(`${act.label}.done`);
        toast.show(done === `${act.label}.done` ? sceneWords(act.label) : done);
        return;
      }
      // R-ROUTE-008: the school's deposit is paid at the bank through a card the world sends itself.
      case "command":
        setPicked(act.command === undefined ? null : { kind: "command", command: act.command });
        return;
      // R-WORLD-005: a free act that fills a slot happens at once, seen on the thing; the line says it counts when the month ends.
      case "do": {
        setPicked(null);
        const option = act.stages === undefined ? undefined : view.activities.find((candidate) => candidate.id === act.stages);
        if (option === undefined) return;
        const added = addToPlan({ activity: option.id, param: option.params?.[0] ?? null });
        cue(added ? "done" : "tap");
        const done = sceneWords(`${act.label}.done`);
        toast.show(added ? (done === `${act.label}.done` ? say("ui.world.planned", { what: nameOf(option.id) }) : done) : say("ui.world.full"));
        return;
      }
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
      // R-WORLD-013: the door cuts out to the street. A room reached from the map (the hub in Yaba) steps out to the place whose door opens into it.
      const outside = OUTSIDE_OF[placeId];
      if (inside) cutTo(() => setInside(false));
      else if (outside !== undefined) cutTo(() => setPlaceId(outside));
      // A room with no street of its own (the arrivals hall): the door opens the map.
      else setMap(true);
    }
    // The cut reads the latest state when it fires; only a new pick starts one.
  }, [picked]);
  const pins: Pin[] = (() => {
    if (!world) return [];
    const been = readKept(BEEN_KEY);
    const home = HOMES[where] ?? null;
    // A built place with no position of its own (an office or a clinic known by its area) stands at its area's middle, each a little apart.
    const spotted = new Map<string, number>();
    const spotOf = (place: PlaceEntry): { latE3: number; lonE3: number } => {
      if (place.position !== null) return place.position;
      if (place.id === home) return HOME_SPOT;
      const area = place.area ?? "";
      const index = spotted.get(area) ?? 0;
      spotted.set(area, index + 1);
      const middle = areaSpot(area) ?? HOME_SPOT;
      return { latE3: middle.latE3 + (index % 2 === 0 ? 2 : -2) * Math.ceil(index / 2), lonE3: middle.lonE3 + 3 * index };
    };
    return places
      .filter((place) => (place.position !== null || place.id === home || (place.area !== null && shipped?.has(place.id) === true)) && (shipped === null || shipped.has(place.id) || place.id === home))
      .map((place) => {
        const reached = stopReached(view.chapter, where, place.id);
        const state: PinState = place.id === placeId ? "here" : place.id === home ? "home" : been.includes(place.id) ? "been" : !reached ? "not" : shipped === null || shipped.has(place.id) ? "can" : "not";
        return { id: place.id, name: place.id === "place.yaba" ? say("ui.inside.hub") : placeName(place.id), state, position: spotOf(place), things: place.stages.length };
      });
  })();
  // At home the map is Lagos; abroad it is the country the character is in. The rest are shut until a visa opens them.
  const countries: CountryChoice[] = [
    { id: "lagos", name: cityWords("city.map.lagos"), locked: where === "home" ? null : cityWords("city.map.not-open") },
    ...COUNTRIES.map((id) => ({ id, name: nameOf(id), locked: where === "abroad" && id === country ? null : cityWords(where === "road" ? "city.map.not-open" : "city.map.no-visa") })),
  ];
  const shownCountry = countries.find((choice) => choice.locked === null) ?? countries[0] ?? { id: "lagos", name: cityWords("city.map.lagos"), locked: null };

  const nudge = world ? nudgeOf(view, undefined, plan.flatMap((pick) => (pick === null ? [] : [pick.activity]))) : null;
  // A question or an offer waiting on the player opens from the nudge; nothing else is on screen to open it (R-WORLD-001).
  const nudgeOpens = asks !== undefined && (nudge?.about === "setpiece" || nudge?.about === "offer");
  // The chapter's step opens its way (R-WORLD-003): the thing's acts when it stands here, the map at its stop
  // when it is elsewhere in the city, and the Month sheet when the step is the month's end.
  // A step short of money sends the player to the jobs board, where the money is; the funds step keeps the bank.
  const shortOfMoney = nudge?.about === "step" && (nudge.key.endsWith(".short") || nudge.key === "ui.nudge.hunt-planned") && !nudge.key.startsWith("chapter.decision-day.item.held");
  const stepWay = nudge?.about === "step" ? (shortOfMoney ? BOARD_WAY : stepWayOf(view)) : null;
  const hereId = inside ? (insideEntry?.id ?? placeId) : placeId;
  const stepThing = stepWay === null || things === undefined ? null : stepThingHere(stepWay, hereId, things);
  // Abroad the map is a list, and a stop picked on it opens its sheet all the same.
  // A result on its way is only waited for: its nudge says when it comes and opens nothing.
  // The nudge as it reads here: a step's place is not named while the player stands in it.
  const shownNudge = nudge === null || nudge.about !== "step" ? nudge : nudgeHere(nudge, stepThing);
  const onlyWait = nudge !== null && WAIT_ONLY.has(nudge.key);
  const nudgeGoes = !onlyWait && stepWay !== null && (stepThing !== null || stepWay.go === null || where === "home" || where === "abroad");
  const followStep = (): void => {
    if (stepWay === null) return;
    const opens = stepOpen(stepWay, stepThing, view.activities.filter((option) => option.allowed).map((option) => option.id), placeId);
    switch (opens.kind) {
      case "act":
        setPicked({ kind: "action", activity: opens.activity });
        return;
      case "thing": {
        const thing = things?.find((candidate) => candidate.id === opens.thing);
        if (thing !== undefined) setPicked({ kind: "thing", thing });
        return;
      }
      case "month":
        setMonthOpen(true);
        return;
      case "map":
        setMapPick(opens.stop);
        setMap(true);
        return;
      default: {
        const never: never = opens;
        throw new Error(`Unknown way: ${String(never)}`);
      }
    }
  };
  // R-WORLD-002: the band's second row opens from its handle and peeks for a few seconds when its words change.
  const [bandOpen, setBandOpen] = useState(false);
  const [peek, setPeek] = useState(true);
  const nudgeKey = nudge?.key ?? "";
  const coming = soonest(view);
  const comingKey = coming === null ? "" : `${coming.what}|${String(coming.month)}`;
  useEffect(() => {
    setPeek(true);
    const timer = window.setTimeout(() => setPeek(false), PEEK_MS);
    return () => window.clearTimeout(timer);
  }, [nudgeKey, comingKey, view.turns.banked]);
  const endBlocked = view.ended ? words("reject.ended") : view.setpiece !== null || (view.interview?.question ?? null) !== null ? words("reject.setpiece-open") : view.turns.banked < 1 ? words("reject.no-turns") : null;
  // One action, one sheet: a paper slip for a paper thing, a card for the rest.
  const ask: Ask | null = (() => {
    if (world && picked?.kind === "command" && picked.command === "route/depart" && departDue !== null) {
      const route = departDue;
      // The flight's cost from tuning unless the employer pays; held funds still open stop the flight (route/depart).
      const flight = content.tuning.route.flight;
      const employerPays = content.route[route]?.flightPaidByEmployer === true;
      const heldOpen = view.obligations.some((owed) => content.obligation[owed.entry]?.type === "held-funds");
      return {
        form: "card",
        icon: "plane",
        who: hereName,
        title: say("ui.route.depart"),
        line: say("ui.world.depart-line", { country: say(`ui.country.place.${content.route[route]?.country ?? ""}`) }),
        // The flight's amount is a plain figure in tuning; a world variable would need the simulation's reading.
        cost: employerPays || typeof flight.amount !== "number" ? null : { amount: flight.amount, currency: flight.currency },
        when: "now",
        ...(heldOpen ? { blocked: say("ui.world.depart-held") } : {}),
        button: say("ui.route.depart"),
        act: () => {
          void send({ type: "route/depart", route }).then((reply) => cue(reply?.ok === true ? "whoosh" : "tap"));
          setPicked(null);
        },
        dismiss: () => setPicked(null),
      };
    }
    if (world && picked?.kind === "command" && picked.command === "obligation/pay" && heldDue !== null) {
      const amount = heldDue.outstanding;
      return {
        form: "card",
        icon: "bank",
        who: hereName,
        title: say("ui.world.pay-back"),
        line: say("ui.world.pay-back-line", { amount: formatMoney(amount, "NGN") }),
        cost: { amount, currency: "NGN" },
        when: "now",
        // The repayment leaves the funds held for the character, never the pockets: the second line says so instead of a figure left.
        note: say("ui.world.pay-back-note"),
        button: say("ui.world.pay-back"),
        act: () => {
          void send({ type: "obligation/pay", obligation: heldDue.id, amount }).then((reply) => {
            cue(reply?.ok === true ? "coin" : "tap");
            if (reply?.ok === true) toast.show(say("ui.world.pay-back-paid"));
          });
          setPicked(null);
        },
        dismiss: () => setPicked(null),
      };
    }
    if (world && picked?.kind === "command" && picked.command === "route/pay-deposit" && depositDue !== null) {
      const school = content.school[depositDue.school];
      if (school === undefined) return null;
      const deposit = { amount: school.deposit, currency: "GBP" };
      return {
        form: "card",
        icon: "bank",
        who: hereName,
        title: say("ui.route.pay-deposit"),
        line: say("ui.world.deposit-line", { school: nameOf(depositDue.school), route: nameOf(depositDue.route) }),
        cost: deposit,
        when: "now",
        button: say("ui.route.pay-deposit"),
        act: () => {
          void send({ type: "route/pay-deposit", route: depositDue.route, school: depositDue.school }).then((reply) => {
            cue(reply?.ok === true ? "coin" : "tap");
            if (reply?.ok === true) toast.show(say("ui.route.deposit-paid", { amount: formatMoney(school.deposit, "GBP") }));
          });
          setPicked(null);
        },
        dismiss: () => setPicked(null),
      };
    }
    if (!world || picked?.kind !== "action" || picked.more !== undefined) return null;
    const activity = picked.activity;
    const option = view.activities.find((candidate) => candidate.id === activity);
    if (option === undefined) return null;
    // A choice inside the activity (which job to hunt, which school) is the player's: the picker shows it, not a card that takes the first,
    // unless the thing tapped made the choice (a job on a board), when the card names it (R-WORLD-005).
    const chosen = picked.param !== undefined && option.params?.includes(picked.param) === true ? picked.param : null;
    if (option.params !== null && (option.params.length > 1 || content.activity[activity as keyof typeof content.activity]?.param === "job") && chosen === null) return null;
    // R-WORLD-006: on a long shot the English test's sheet is the picker, which carries the study act beside the test.
    const chance = activity === ENGLISH_TEST ? testChance(view) : null;
    if (chance !== null && chance.study !== null) return null;
    const first = option.cost[0] ?? null;
    const cost = first === null ? null : { ...first, amount: option.cost.filter((part) => part.currency === first.currency).reduce((sum, part) => sum + part.amount, 0) };
    const paper = activity === "activity.play-lotto" || activity === "activity.bet-slip";
    return {
      form: paper ? "slip" : "card",
      icon: paper ? "ticket" : "hand",
      who: hereName,
      // A side job on the hunt's card says it sits beside the day job and carries its own line; a job a board names carries its pay and chance.
      title: chosen === null ? nameOf(activity) : content.activity[chosen as Id<"activity">]?.slot === "side" ? say("ui.world.side-job-title", { job: paramWords(chosen) }) : `${nameOf(activity)}: ${paramWords(chosen)}`,
      line:
        chosen !== null && content.activity[chosen as Id<"activity">]?.slot === "side"
          ? [blurbOf(chosen) ?? blurbOf(activity), jobCardWords(view, chosen)].filter((part): part is string => part !== null).join(" ")
          : chosen !== null && content.activity[activity as Id<"activity">]?.param === "job"
            ? [blurbOf(activity), jobCardWords(view, chosen)].filter((part): part is string => part !== null).join(" ")
            : chance !== null
              ? [blurbOf(activity), chance.words].filter((part): part is string => part !== null).join(" ")
              : (blurbOf(activity) ?? ""),
      cost: cost === null ? null : { amount: cost.amount, currency: cost.currency },
      button: nameOf(activity),
      ...(paper ? { reference: clock.toUpperCase() } : {}),
      ...(option.allowed ? {} : { blocked: needsWords(option.missing) }),
      act: () => {
        const added = addToPlan({ activity: option.id, param: chosen ?? option.params?.[0] ?? null });
        cue(added ? (cost === null ? "done" : "coin") : "tap");
        setPicked(null);
        toast.show(added ? say("ui.world.planned", { what: nameOf(option.id) }) : say("ui.world.full"));
      },
      dismiss: () => setPicked(null),
    };
  })();

  // R-CHAPTER-008: the party answered, the sheet closes and the scene cuts to the full yard with the party's line over it, for a beat.
  const [partyBeat, setPartyBeat] = useState(false);
  const wasPartied = useRef(partied);
  useEffect(() => {
    const before = wasPartied.current;
    wasPartied.current = partied;
    if (!partied || before) return;
    setAsksOpen(false);
    setPicked(null);
    cutTo(() => setPartyBeat(true));
    // The cut runs once, as the answer lands.
  }, [partied]);
  useEffect(() => {
    if (!partyBeat) return;
    const timer = window.setTimeout(() => setPartyBeat(false), PARTY_BEAT_MS);
    return () => window.clearTimeout(timer);
  }, [partyBeat]);
  useEffect(() => {
    if (resultsOpen) setPartyBeat(false);
  }, [resultsOpen]);
  // The Month sheet gives way to the results when the month ends; the asks sheet closes once nothing waits.
  useEffect(() => {
    if (reportOpen) {
      setMonthOpen(false);
      setPicked(null);
    }
  }, [reportOpen]);
  // A pick added from the picker's sheet is said in a toast and the sheet closes, as the ask card does (R-WORLD-006).
  const lastPlan = useRef(plan);
  useEffect(() => {
    const before = lastPlan.current;
    lastPlan.current = plan;
    if (!world || picked?.kind !== "action" || ask !== null) return;
    const added = plan.find((pick, index) => pick !== null && before[index] !== pick && !before.includes(pick));
    if (added === undefined || added === null) return;
    toast.show(say("ui.world.planned", { what: nameOf(added.activity) }));
    setPicked(null);
  }, [plan, world, picked, ask, toast]);
  useEffect(() => {
    if (!nudgeOpens && asksHold !== true) setAsksOpen(false);
  }, [nudgeOpens, asksHold]);
  // A set piece's sheet opened from its thing closes once the set piece is over and its last line said.
  const setpieceOver = view.setpiece === null && asksHold !== true;
  useEffect(() => {
    if (setpieceOver && picked?.kind === "action" && picked.activity.startsWith("setpiece.")) setPicked(null);
  }, [setpieceOver, picked]);
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
            // The drawn city is Lagos; abroad the map is its list of stops until that city is drawn (R-WORLD-015).
            drawing: drawing && where === "home",
            diveTo,
            pickFirst: mapPick,
            ...(rideBy === null ? {} : { by: rideBy }),
            home: HOMES[where] ?? null,
            onGo: (id) => {
              setPlaceId(id);
              setMap(false);
              setDiveTo(null);
              setRideBy(null);
              setMapPick(null);
              toast.show(placeName(id));
            },
            onClose: () => {
              setMap(false);
              setDiveTo(null);
              setRideBy(null);
              setMapPick(null);
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
            name={hereName}
            {...bandMoney(view)}
            onEndMonth={() => setMonthOpen(true)}
            {...(view.turns.banked <= 3 ? { turns: view.turns.banked } : {})}
            endBlocked={endBlocked}
            hidden={map || resultsOpen}
            open={bandOpen}
            {...(coming === null ? {} : { onToggle: () => setBandOpen((open) => !open) })}
            more={
              !(phone || monthOpen || asksOpen || menu || credits || picked !== null) ? (
                <div key={bandOpen ? "open" : `peek-${nudgeKey}-${comingKey}`} className={bandOpen ? "" : "drop"}>
                  <Nudge nudge={shownNudge} {...(nudgeOpens ? { onTap: () => setAsksOpen(true) } : nudgeGoes ? { onTap: followStep } : nudge?.about === "report" ? { onTap: () => { setPhoneApp("news"); setPhone(true); } } : nudge?.about === "dues" ? { onTap: () => { setPhoneApp("bank"); setPhone(true); } } : {})} />
                  {coming === null || !(bandOpen || peek) ? null : (
                    <p className="chip pointer-events-auto mt-1.5 inline-flex max-w-full items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-bold" data-coming>
                      <Clock size={14} aria-hidden />
                      <span className="truncate">{say("ui.world.coming", { what: coming.what, when: inMonths(coming.month, view.month) })}</span>
                    </p>
                  )}
                </div>
              ) : null
            }
          />
          <ThumbBar onMap={() => setMap(true)} onPhone={() => { setPhoneApp(null); setPhone(true); }} phoneWaiting={phoneWaiting ?? view.offers.length > 0} hidden={map || resultsOpen} />
          {zoomed && !map ? (
            <button type="button" onClick={() => setZoomed(false)} className="chip drop pointer-events-auto fixed bottom-[calc(max(14px,env(safe-area-inset-bottom))+76px)] left-1/2 z-[38] -translate-x-1/2 px-3 py-2 text-[13px] font-bold" data-zoom-preset>
              {say("ui.world.whole")}
            </button>
          ) : null}
          {heard !== null && !covered && !resultsOpen ? (
            <p key={heardCount} className="chip drop pointer-events-none fixed bottom-[calc(max(14px,env(safe-area-inset-bottom))+76px)] left-3 z-[36] max-w-[70vw] px-3 py-1.5 text-[12px] font-bold" data-chatter>
              {heardWords(heard.key, heard.params)}
            </p>
          ) : null}
          <Toast words={toast.words} />
          {partyBeat ? (
            <button type="button" onClick={() => setPartyBeat(false)} className="pop pointer-events-auto fixed inset-x-0 bottom-[calc(max(14px,env(safe-area-inset-bottom))+124px)] z-[45] flex justify-center px-6" data-party-beat>
              <span role="status" className="band rounded-[6px] px-4 py-3 text-center text-[16px] leading-snug font-bold shadow-xl">
                {words(PARTY_SAID)}
              </span>
            </button>
          ) : null}
          <Cut cutting={cutting} />
          {!openingSeen && view.report === null && view.chapter.current !== null && !view.ended ? (
            <FullScreen open onClose={() => setOpeningSeen(true)} title={nameOf(view.chapter.current)} tone="over">
              <div className="flex max-w-sm flex-col items-center gap-5 text-center" data-opening={view.chapter.current}>
                <p className="label label-strong text-[11px] tracking-[0.3em] uppercase opacity-80">{nameOf(view.chapter.current)}</p>
                <p className="text-[24px] leading-snug font-bold">{words(openingKey(view))}</p>
                <p className="text-[15px] opacity-90">{say(shownNudge?.key ?? "ui.nudge.end", shownNudge?.params ?? {})}</p>
                <Button
                  onClick={() => {
                    setOpeningSeen(true);
                    if (nudgeGoes) followStep();
                  }}
                  data-opening-go
                >
                  {say("ui.opening.go")}
                </Button>
              </div>
            </FullScreen>
          ) : null}
        </>
      ) : null}
      {looking ? (
        <div className="pointer-events-none fixed inset-0 z-[36] flex flex-col justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {world ? null : (
            <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-sheet-line bg-sheet p-2">
              <div className="flex min-w-0 flex-1 flex-col px-1">
                <h2 className="truncate font-display text-xl leading-tight">{name}</h2>
                {sample === null ? null : <p className="text-xs text-text-2">{cityWords(`city.band.${sample.band}`)}</p>}
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
            {loading ? <p className="pointer-events-auto rounded-lg bg-sheet/90 px-3 py-2 text-sm">{cityWords("city.loading", { place: name, percent })}</p> : null}
            {failed === null ? null : <p className="pointer-events-auto rounded-lg bg-sheet/90 px-3 py-2 text-sm text-bad">{cityWords("city.failed", { place: name })}</p>}
            {/* In the world only the band, the nudge and the two thumb buttons stand over the place (R-WORLD-001): the question, the offers and the month's lines open from the nudge, the results and the phone. */}
            {!world && scene !== null && scene.place === placeId ? (
              <div className="pointer-events-auto flex flex-col gap-2 rounded-xl border border-accent bg-sheet-2 p-4 shadow-lg" data-scene={scene.setpiece}>
                <p className="text-sm text-text-2">{cityWords("city.scene.at", { place: name })}</p>
                {scene.question === null ? null : <p className="text-lg font-semibold">{words(scene.question)}</p>}
                <div>
                  <Button small variant="primary" onClick={() => setLooking(false)}>
                    {cityWords("city.scene.answer")}
                  </Button>
                </div>
              </div>
            ) : null}
            {(world ? [] : offers).map((offer) => (
              <p key={offer} className="pointer-events-auto rounded-lg border border-sheet-line bg-sheet-2 px-3 py-2 text-sm">
                {cityWords("city.offer.here", { offer: placeName(offer) })}
              </p>
            ))}
            {world || lines.length === 0 ? null : (
              <div className="pointer-events-auto flex flex-col gap-1 rounded-xl border border-sheet-line bg-sheet-2 p-3 text-sm" data-report-here>
                <p className="font-semibold">{cityWords("city.report.here")}</p>
                {lines.map((line, index) => (
                  <p key={`${line.key}-${String(index)}`}>{words(line.key, line.params)}</p>
                ))}
              </div>
            )}
            {world ? null : adverts?.(placeId)}
            {world || heard === null ? null : (
              <p className="pointer-events-auto self-start rounded-2xl rounded-bl-sm bg-strong px-3 py-2 text-sm text-on-strong" data-overheard>
                {heardWords(heard.key, heard.params)}
              </p>
            )}
            {picked === null || picked.kind === "action" || picked.kind === "command" || picked.kind === "ride" || picked.kind === "enter" || picked.kind === "inside" || picked.kind === "thing" ? null : <PersonCard picked={picked} words={cardWords()} onClose={() => setPicked(null)} />}
            {world ? null : (
              <p className="pointer-events-auto self-start rounded-lg bg-sheet/80 px-2 py-1 text-xs text-text-2">{cityWords("city.hold")}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="fixed top-16 right-3 z-20 flex flex-col items-end gap-1">
          <Button small onClick={() => setLooking(true)} className="bg-sheet-2/95 shadow-md">
            <MapIcon size={16} />
            {cityWords("city.look")}
          </Button>
          {loading ? <p className="rounded-md bg-sheet-2/95 px-2 py-1 text-xs text-text-2 shadow-sm">{cityWords("city.loading", { place: name, percent })}</p> : null}
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
                  className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left hover:bg-sheet-muted ${place.id === placeId ? "font-semibold" : ""}`}
                >
                  {placeName(place.id)}
                  {place.id === placeId ? <span className="text-xs text-text-2">{cityWords("city.here")}</span> : null}
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
          <p className="text-sm text-text-2">{cityWords("city.graphics.now", { mode: cityWords(`city.mode.${mode}`) })}</p>
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
      {world ? <AskSheet ask={ask} formatMoney={(amount, currency) => formatMoney(amount, currency as "NGN")} {...(askIcon === undefined ? {} : { icon: askIcon })} /> : null}
      {world && picked?.kind === "action" && ask === null ? (
        <WorldSheet
          open
          onClose={() => setPicked(null)}
          label={clock}
          title={cardWords()}
          mark="ask"
          {...(picked.activity.startsWith("chapter.") && nudgeGoes
            ? {
                foot: (
                  <button
                    type="button"
                    className="btn-main"
                    onClick={() => {
                      setPicked(null);
                      followStep();
                    }}
                    data-chapter-go
                  >
                    <span>{say("ui.chapter.go")}</span>
                    <span className="text-[13px] font-semibold opacity-80">{say(shownNudge?.key ?? "ui.nudge.end", shownNudge?.params ?? {})}</span>
                  </button>
                ),
              }
            : // An ask answered at its place lists what still waits elsewhere, and opens it.
              picked.activity.startsWith("offer.") && asks !== undefined && stillWaiting(view.offers, [picked.activity, ...(picked.more ?? [])]).length > 0
              ? {
                  foot: (
                    <StillWaiting
                      offers={stillWaiting(view.offers, [picked.activity, ...(picked.more ?? [])])}
                      onOpen={() => {
                        setPicked(null);
                        setAsksOpen(true);
                      }}
                    />
                  ),
                }
              : {})}
        >
          {actions?.([picked.activity, ...(picked.more ?? [])])}
        </WorldSheet>
      ) : null}
      <Sheet open={!world && picked?.kind === "action"} onOpenChange={(open) => { if (!open) setPicked(null); }} title={picked?.kind === "action" ? cardWords() : ""}>
        {picked?.kind === "action" ? actions?.([picked.activity]) : null}
      </Sheet>
      {world ? (
        <WorldSheet open={monthOpen} onClose={() => setMonthOpen(false)} label={clock} title={cityWords("city.month.title")} mark="month">
          {month}
        </WorldSheet>
      ) : null}
      {world && asks !== undefined ? (
        <WorldSheet
          open={asksOpen}
          onClose={() => setAsksOpen(false)}
          label={askList === null || askCount < 2 ? hereName : say("ui.world.ask-of", { n: Math.min(askIndex, askCount - 1) + 1, count: askCount })}
          title={say(nudge?.key ?? "ui.nudge.end")}
          mark="asks"
          {...(askList !== null && askCount > 1
            ? {
                foot: (
                  <div className="flex items-center justify-between gap-2" data-asks-foot>
                    <button type="button" className="chip press px-3 py-2 text-[13px] font-bold disabled:opacity-40" disabled={askIndex === 0} onClick={() => setAskIndex((index) => Math.max(0, index - 1))} data-asks-back>
                      {say("ui.world.ask-back")}
                    </button>
                    <button type="button" className="chip press px-3 py-2 text-[13px] font-bold disabled:opacity-40" disabled={askIndex >= askCount - 1} onClick={() => setAskIndex((index) => Math.min(askCount - 1, index + 1))} data-asks-next>
                      {say("ui.world.ask-next")}
                    </button>
                  </div>
                ),
              }
            : {})}
        >
          {(() => {
            const index = Math.min(askIndex, Math.max(0, askCount - 1));
            const at = asksAt?.[askList === null ? 0 : index] ?? null;
            const there = at !== null && (placeId === at || (inside && insideEntry?.id === at));
            if (at !== null && !there) {
              return (
                <div className="flex flex-col gap-4" data-ask-away={at}>
                  <p className="text-[15px] leading-snug text-text-2">{say(hasWords(`ui.world.ask-away.${at}`) ? `ui.world.ask-away.${at}` : "ui.world.ask-away", { place: placeName(at) })}</p>
                  <button
                    type="button"
                    className="btn-main"
                    onClick={() => {
                      setAsksOpen(false);
                      setMapPick(at === placeId ? null : at);
                      setMap(true);
                    }}
                    data-ask-go
                  >
                    {say("ui.world.go-there")}
                  </button>
                </div>
              );
            }
            return askList === null ? asks : askList[index];
          })()}
        </WorldSheet>
      ) : null}
      {world && resultsShown ? results?.(inside && insideEntry !== null && insideEntry.id !== entry?.id ? placeName(insideEntry.id) : name) : null}
      {world && phone && handset !== undefined ? handset(() => { setPhone(false); setPhoneApp(null); }, inside ? hereName : name, phoneApp) : null}
      {world && phone && handset === undefined && apps !== undefined ? <Phone apps={apps} onClose={() => setPhone(false)} /> : null}
      <Sheet open={picked?.kind === "ride"} onOpenChange={(open) => { if (!open) setPicked(null); }} title={picked?.kind === "ride" ? cardWords() : ""} description={cityWords("city.ride.title")}>
        {picked?.kind === "ride" ? (
          <ul className="flex flex-col gap-1" aria-label={cityWords("city.ride.title")} data-ride-list>
            {[...pins.filter((pin) => pin.state === "home"), ...pins.filter((pin) => pin.state !== "home" && pin.state !== "here" && pin.state !== "not")].map((pin) => {
              const here = pins.find((candidate) => candidate.state === "here");
              return (
                <li key={pin.id}>
                  <button type="button" onClick={() => travel(pin.id)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left hover:bg-sheet-muted">
                    <span className="font-semibold">{pin.state === "home" ? cityWords("city.ride.home") : pin.name}</span>
                    <span className="text-xs text-text-2">{here === undefined ? "" : cityWords("city.ride.line", { minutes: minutesBetween(here.position, pin.position) })}</span>
                  </button>
                </li>
              );
            })}
            {pins.filter((pin) => pin.state !== "here" && pin.state !== "not").length === 0 ? <li className="px-3 py-2 text-sm text-text-2">{cityWords("city.ride.none")}</li> : null}
          </ul>
        ) : null}
      </Sheet>
    </>
  );
}
