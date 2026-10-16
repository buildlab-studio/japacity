// The city (docs/rules/city.md): a full-screen scene under the panels, brought in front of them by
// "Look around". It reads the view and never changes it: entering a place, walking and tapping are
// this screen's own state, and nothing here sends a command (R-CITY-001). The 3D scene is loaded
// only where WebGL exists, so the panels never wait for it (R-CITY-018).
import { content, text } from "@japacity/content";
import type { Id, PlaceEntry, PlayerView, ReportLine } from "@japacity/sim";
import { Clock, Map as MapIcon, Settings2, X } from "lucide-react";
import { isValidElement, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { readPerson } from "../../authority/person";
import { bandName as characterName } from "../../shared/card/face";
import { FigurePicture } from "../../shared/frontdoor/LookPicture";
import { lookOf } from "../../shared/frontdoor/looks";
import { plannedShut, worldVar } from "../../authority/store";
import { keptLookFile } from "../../authority/person";
import { chooseGraphics, setGraphicsMode } from "../../shared/graphics/mode";
import { loadModel } from "../../shared/three/load";
import { assetUrl, loadJson, loadManifest } from "../../shared/three/manifest";
import { Button } from "../../shared/ui/Button";
import { Sheet } from "../../shared/ui/Sheet";
import { cardKey, useCardsTurn } from "../../shared/ui/stage";
import { formatMoney } from "../../shared/words/format";
import { jobCardLine, jobCardWords } from "../../shared/words/jobs";
import { countsWords } from "../../shared/words/profile";
import { needsWords } from "../../shared/words/requirement";
import { newsRead } from "../../shared/phone/newsSeen";
import { earlyStops, sixteenPath } from "../../shared/words/sixteen";
import { blurbOf, hasWords, inMonths, nameOf, paramWords, say, words } from "../../shared/words/text";
import { ENGLISH_TEST, testChance } from "../../shared/words/test";
import { AskSheet } from "../../shared/world/AskSheet";
import { PARCEL, parcelAsk } from "../../shared/world/parcel.ask";
import { Band, bandMoney, bandMonth } from "../../shared/world/Band";
import { type MoneyIn, MoneyToast } from "../../shared/world/MoneyToast";
import { type Said, SaidToast } from "../../shared/world/SaidToast";
import { cue } from "../../shared/sound/cues";
import { Rejection } from "../../shared/ui/Rejection";
import type { Act, Ask, CountryChoice, Pin as ContractPin, PinState, RideChoice, Thing } from "../../shared/world/contract";
import { Cut, useCut } from "../../shared/world/Cut";
import { type PlaneCutSlot, sendOff, useSendOffShowing } from "../../shared/world/sendOff";
import { Nudge } from "../../shared/world/Nudge";
import { ThumbBar } from "../../shared/world/ThumbBar";
import { Corner, hush, murmur, resetLines, speak, SpeechBubble, tell, useLines, useStreetTalk } from "../../shared/world/Lines";
import { calloutsShown } from "../../shared/world/callouts";
import { Emotes } from "./emotes";
import { Rise, useJapaRise } from "../../shared/world/Rise";
import { CentredColumn } from "../../shared/ui/lively/CentredColumn";
import { PressButton } from "../../shared/ui/lively/PressButton";
import { FirstUseLabels, useFirstUse } from "../../shared/world/Walkthrough";
import { markTaught, wasTaught } from "../../shared/world/taught";
import { type Arranged, arrangedIn, keepArranged, keepTurn, turnIn } from "../../shared/world/arranged";
import { buyModeAt, showOwned } from "./owned";
import { WorldSheet } from "../../shared/world/WorldSheet";
import { useDayClock } from "../../shared/world/dayClock";
import { bodyWords, tired } from "../../shared/words/body";
import { actOnCard, answersNow, nowActOf, nowActsIn, nowLineIn } from "../../shared/words/acts";
import { chipEffectsLine, chipTimeOf } from "../../shared/words/chips";
import { actsOffered, answerAsk, askHeader, isPaper, KIOSK_CAP, kioskAnswer, withPlanned, withSpent } from "./acts";
import { earnedShort, kioskCapReached } from "../../shared/words/lotto";
import { doActLine, lightBack, nowLands, plainActLine, plannedMarks, SHOWN_BY_SCENE } from "./actLines";
import { hasAbroadWords, loadAbroadWords } from "./abroadWords";
import { onShift, shiftMarks } from "./shift";
import { NAP, SLEEP_MS, sleepMsOf, wakeCommand, wokeWords } from "./sleep";
import { cityWords, heardWords, placeName, residentName, roleWords } from "./city.words";
import { CreditsSheet } from "./Credits";
import { crowdTuning } from "./limits";
import { localDate, type Other, poolOf, sampleCrowd } from "./crowd";
import { atNight, BETTER_JOB, BOARD_WAY, MEANWHILE_WAYS, MORNING, NIGHT, nudgeOf, stepThingHere, stepWayOf } from "./nudge";
import { nudgeHere, stepOpen } from "./stepOpen";
import { StillWaiting, stillWaiting } from "./StillWaiting";
import { type Device, enterPlace, keepChoice, type Mode, type ModeChoice, modeSettings, observeFrame, readChoice, startingMode, watchFrames } from "./mode";
import { overheard, speakerOf } from "./overheard";
import { dancerShown, dressPlace, filesOf, openGround, parkCar, type PlaceFile, showPlanned, stageFilePath, stageOf } from "./placeFile";
import { shotOf, turnsRound } from "./shot";
import { HOUSE, insideOf, roomOf } from "./room";
import { personOf, personOfLook } from "./roster";
import type { Picked, ScenePick } from "./scene.types";
import { APPLY_TO_SCHOOL, SCHOOL_ICON, schoolSheetLine } from "./school";
import { sceneWords } from "./scene.words";
import { byHandAt, enterable, homeStagesAt, offersHere, openingPlace, openScene, reportHere, roomSpot, servesHere, type ViewPlace } from "./staging";
import { type Coming, soonest } from "../../shared/words/coming";
import { stagedNow, thingsNow, thingsOf, vehicleOf, withMoreAt } from "./things";
import { Fan } from "./fan/Fan";
import { GO_HOME, goHomeAsk, goHomeOffered } from "./goHome";
import { type Brief, briefOf, DONE_TOAST_MS, doneToast, itemsDone, markerAllowed, nextBase, briefTitle } from "./brief/brief";
import { ChapterClose, MissionCard } from "./brief/BriefCards";
import { BriefChip, Marker } from "./brief/BriefChip";
import { briefHanded, handBrief } from "../../shared/world/briefHanded";
import { allNow, fanEntriesOf, type FanEntry, fanModel } from "./fan/fanActs";
import { FanSheet } from "./fan/FanSheet";
import { stopReached } from "./stops";
import { KIOSK, opensKiosk, withKiosk } from "./kiosk";
import { namedThings } from "./mark";
import { sameLine } from "../../shared/moment/moment";
import { WORLD_LIMITS } from "../../../../../tools/assets/world-check";
import { onMap } from "../../shared/world/rentedHomes";
import { LoadingNote } from "./LoadingNote";
import { COURT, courtedTold, DECEMBER, makeRoom, roomFor, roomNear, roomOpen, roomPartner, standingAsThemselves, standingAt, talkAsk, THEIR_ROOM, withMeetings, withStanding } from "./meetings";

/** Nudges that name a wait with nothing to do but end months: the English result on its way, or sealed until the morning (R-CLOCK-032). */
const WAIT_ONLY: ReadonlySet<string> = new Set(["chapter.build-the-file.item.english.started", MORNING]);
/**
 * The nudges that stand under the band whatever the place (the plan 16): someone waiting on the player (a question, an
 * offer) and the dues abroad; the night's bed comes as its own moment. The road's step shows only in the moment, as the
 * brief's chip; the news and the month's end wait on the phone.
 */
const STANDING_NUDGES: ReadonlySet<string> = new Set(["setpiece", "offer", "dues"]);

const CityScene = lazy(() => import("./CityScene"));
const Bag = lazy(() => import("./Bag"));
// The send-off as a scene (chapter.md R-CHAPTER-012): its own chunk, fetched only when the gate's act is picked (R-ENGINE-020).
const SendOffScene = lazy(() => import("./sendoff/SendOffScene"));
/**
 * Who the character is in the send-off scene (R-CHAPTER-012): the band's name (the one given at the door, else the life's
 * own), the first name the stub carries, the look and the figure in their own colours (R-PROLOGUE-015). Read here, where
 * the person kept beside the save is read already, so the scene's own chunk stays apart from the first visit's.
 */
function sendOffYou(view: { scenario: string }) {
  const kept = readPerson();
  const look = lookOf(kept?.look)?.id ?? lookOf(`chr_${view.scenario.slice("scenario.".length)}`)?.id ?? "chr_ada";
  // One name everywhere, the band's (share.md R-SHARE-004 as amended 16 Oct 2026), read from the card's own source.
  const name = characterName(view.scenario) ?? "";
  return { name, first: name, look, figure: <FigurePicture look={look} style={kept?.look === look ? kept.style : undefined} view="figure" className="so-fig" /> };
}

// Development only: the picture runs open a beat of the send-off straight from the page (a player's build drops it).
if (import.meta.env.DEV && typeof window !== "undefined") Object.assign(window, { __sendOff: sendOff });

const city = content.tuning.city;
const PLACES = Object.values(content.place);
/** How long a line overheard stays before the next is heard, off the world (the road's city behind its panel). */
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
/** The home of each where when the view names none: the family house, then the room abroad. */
const HOMES: Record<string, string> = { home: "place.family-house", abroad: "place.the-room" };
/** Where the character lives (home.md R-HOME-006, R-HOME-010): the room in Makoko or in the compound while they live there, else the where's home. */
function homeOf(view: PlayerView): string | null {
  const lived = view.place.where === "home" ? view.home.place : null;
  return lived ?? HOMES[view.place.where] ?? null;
}
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
    // The child of the water has her own opening (R-PROLOGUE-012): her path is the shop counter's, her words are not.
    const water = `${chapter}.open.prologue.water`;
    if (readPerson()?.archetype === "water" && hasWords(water)) return water;
    // The path the prologue built: a degree, a trade, or a trade with the master's settlement in hand.
    const path = `${chapter}.open.prologue.${sixteenPath(view) ?? "trade"}`;
    if (hasWords(path)) return path;
  } else if (hasWords(`${chapter}.open.${slug}`)) return `${chapter}.open.${slug}`;
  return `${chapter}.open`;
}
/** The first chapter by order (R-CHAPTER-001): its opening is a title over the world, never a card (R-CHAPTER-011). */
const FIRST_CHAPTER = Object.values(content.chapter).reduce<{ id: string; order: number } | null>((first, entry) => (first === null || entry.order < first.order ? { id: entry.id, order: entry.order } : first), null)?.id ?? null;
/** How long every name shows over its mark on a place's first entry in a life, before the names fade (R-WORLD-005). */
export const TEACH_MS = 2000;
/** The beat in the room after the month ends, before the scene goes dark for the results (R-WORLD-025): short, never a wait. */
export const RESULTS_BEAT_MS = 300;

/**
 * The giver's words on a chapter's mission card (the brief, design page 13 section 4): the first chapter's opening for this
 * life's path, a later chapter's own opening.
 */
function briefLine(view: Pick<PlayerView, "chapter" | "scenario" | "qualities" | "pockets">): string {
  return words(openingKey(view));
}

/** A closed chapter as its brief, every thing in, for the close's card (section 4). */
function closedBrief(chapter: string, view: Pick<PlayerView, "chapter">): Brief | null {
  const entry = content.chapter[chapter as Id<"chapter">];
  if (entry === undefined) return null;
  return briefOf({ chapter: { current: chapter as Id<"chapter">, items: entry.items.map((item) => ({ id: item.id, met: true })), done: view.chapter.done, closes: true, next: view.chapter.current } }, hasWords(`${chapter}.close`) ? words(`${chapter}.close`) : "");
}

/** A room that is a place of its own on the map, and the street its door opens onto: the hub's file names it as its inside (R-WORLD-013). */
const OUTSIDE_OF: Record<string, string> = { "place.yaba": "place.ojuelegba" };
/** How long a big line leads the corner before the next is told, since the world shows no moment cards (R-WORLD-008). */
const MOMENT_MS = 2600;
/** Home's send-off, and the party set its yard is dressed with once the party is the answer (R-CHAPTER-008). */
const SEND_OFF = "offer.family-send-off";
/** The family house's one party set and its guests, which its file keys to a party offer (R-CITY-011). */
const PARTY_SET = "offer.send-off-party";
/** The party's own line, told over the full yard. */
const PARTY_SAID = `${SEND_OFF}.said.party`;
/** How long the party's line stands over the yard: long enough to read it, then the yard is the player's again. */
export const PARTY_BEAT_MS = 6000;

/** How long after a person's words what follows is told in the corner, as designed. */
const THEN_MS = 1400;
/** The quiet on arriving in a place before anyone in it speaks (the talk budget). */
export const ARRIVE_QUIET_MS = 3000;
/** How long after Mama's words the next compound is heard. */
const UP_NEPA_MS = 2200;

/**
 * The band's chip names the nudge's own wait (R-WORLD-002, R-WORLD-003): the nudge "Ask for the endorsement
 * again in 6 months" over the chip "You can ask for the endorsement again, in 6 months". A step's wait carries its `when`;
 * a chip for something to wait on in that same month is the same wait, so the row peeks with the nudge alone.
 */
export function chipFolds(nudge: { about: string; params?: Record<string, string | number> } | null, coming: Coming | null, month: number): boolean {
  if (nudge === null || coming === null || nudge.about !== "step" || coming.kind === "offer") return false;
  return nudge.params?.when === inMonths(coming.month, month);
}

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

/** The middle of an area's positioned places, for a built place that content gives no position of its own. */
function areaSpot(area: string): { latE3: number; lonE3: number } | null {
  const spots = PLACES.filter((place) => place.area === area && place.position !== null).map((place) => place.position as { latE3: number; lonE3: number });
  if (spots.length === 0) return null;
  return { latE3: Math.round(spots.reduce((sum, spot) => sum + spot.latE3, 0) / spots.length), lonE3: Math.round(spots.reduce((sum, spot) => sum + spot.lonE3, 0) / spots.length) };
}
/** The family house stands on a made-up street (city.md), so the map gives it a spot in Surulere near the hub. */
const HOME_SPOT = { latE3: 6507, lonE3: 3359 };
/** R-WORLD-014: the family house keeps its place on the map while the character lives in a room elsewhere in Lagos, a little from the home spot. */
const FAMILY_SPOT = { latE3: 6511, lonE3: 3353 };
const FAMILY_HOUSE = "place.family-house";
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

/**
 * The band's place line for a home (R-WORLD-002): what the home is, in few words, so a
 * room drawn alone is never read as a whole compound: "Your room, Ojuelegba", "The family house", "The
 * room on the water", abroad "The shared room, Peckham". Makoko is the room on the water only for a life that lives
 * there. Null for any other place, which keeps its own name.
 */
export function homeLine(shown: string, view: Pick<PlayerView, "place" | "home">): string | null {
  switch (shown) {
    case "place.compound-room":
    case "place.hostel-room":
    case "place.family-house":
      return cityWords(`city.home.${shown.slice("place.".length)}`);
    case "place.makoko":
      return view.place.where === "home" && view.home.place === "place.makoko" ? cityWords("city.home.makoko") : null;
    case "place.the-room": {
      // Calgary's basement room, the bed space at the camp, the shared flat on the Domitiana: the room per country (world.md
      // R-WORLD-038 as amended), said short enough for the band beside the age; London keeps its line by the hub's name.
      const own = `city.home.the-room.${view.place.country ?? ""}`;
      if (view.place.where === "abroad" && cityWords(own) !== own) return cityWords(own);
      const hub = PLACES.find((place) => place.hub === true && place.country === view.place.country);
      if (hub === undefined) return bandName(placeName(shown));
      return cityWords("city.home.the-room", { area: hasWords(`${hub.id}.short`) ? say(`${hub.id}.short`) : placeName(hub.id) });
    }
    default:
      return null;
  }
}

/** The band starts the place's name with a capital, "The clinic"; a sentence keeps content's casing. */
function bandName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Where the player last stopped, when it is a place they can still enter (rule 7) and the world's day is still the one
 * they stopped on; once the sky has turned since, they start at home (R-CLOCK-033 as amended; the decision 41:
 * "coming back, you resume at whatever time the world is at; if the sky has turned since you left, you start at home").
 * With no home that can be entered, the hub.
 */
function lastPlace(here: ViewPlace, home: string | null, day: number | null): string {
  const [kept, , keptDay] = readKept(LAST_KEY);
  const open = enterable(here, PLACES);
  const sameDay = day === null || keptDay === undefined || keptDay === String(day);
  if (kept !== undefined && sameDay && open.some((place) => place.id === kept)) return kept;
  return home !== null && open.some((place) => place.id === home) ? home : openingPlace(here, PLACES);
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
    memory: (navigator as { deviceMemory?: number }).deviceMemory ?? null,
  };
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The player's own look: the one built at the front door (R-PROLOGUE-009), else the starting life's person where one is shipped. */
export function ownFile(scenario: string, kept: string | null = keptLookFile()): string {
  return (kept === null ? null : personOf(kept)?.file) ?? personOfLook(`chr_${scenario.slice("scenario.".length)}`)?.file ?? FALLBACK_OWN;
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
      .then((manifest) => loadJson<PlaceFile>(manifest, stageFilePath(place, (path) => assetUrl(manifest, path) !== null)))
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
    <div role="dialog" aria-label={said} className="pointer-events-auto flex items-start gap-3 rounded-md border border-sheet-line bg-sheet-2 p-4 shadow-lg" data-card={picked.kind}>
      <p className="flex-1">{said}</p>
      <button type="button" aria-label={cityWords("city.close")} onClick={onClose} className="inline-flex size-9 items-center justify-center rounded-md border border-sheet-line">
        <X size={18} />
      </button>
    </div>
  );
}

/** A stop as the city hands it to the map: the contract's pin, its line left to the map. */
type Pin = Omit<ContractPin, "line">;

/** What the city hands its map: the stops, the countries, the step's place and what to do on a ride. */
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
  /** Turn back on a ride: the walk back to `from`, the fare gone (R-WORLD-017). */
  onTurnBack?: (from: string, to: string) => void;
  /** The way to choose first on the ride sheet: the vehicle tapped in the place (R-WORLD-017). */
  by?: RideChoice["id"];
  /** A stop to open picked: the nudge's step elsewhere (R-WORLD-003). */
  pickFirst?: string | null;
  /** The place the live step points to: the map opens on its neighbourhood with its sticker ringed and named (the plan 16). */
  step?: string | null;
}

export function City({
  adverts,
  world = false,
  actions,
  results,
  asks,
  asksAt,
  asksHold,
  phone: handset,
  phoneWaiting,
  askIcon,
  cityMap,
  kiosk,
  planeCut,
}: {
  /** `adverts`: the shell's advert slots for the place on screen (R-ADVERT-001), placed beside what is said there. */
  adverts?: (place: string) => ReactNode;
  /** The world mode: the place fills the screen under a see-through bar, with the painted map as its map. */
  world?: boolean;
  /** The world mode's sheet for the actions a tapped thing stages. */
  actions?: (ids: string[]) => ReactNode;
  /** The world mode's results sheet when a month ends (R-WORLD-008), given the name of where the player is. */
  results?: (place: string) => ReactNode;
  /** The world mode's sheet for what the nudge names and waits on the player: the set piece's question, the offers (R-WORLD-003). A list shows one at a time, with Next (R-WORLD-006). */
  asks?: ReactNode | ReactNode[];
  /** For each ask, the place it must be answered at, or null: away from it the sheet shows who waits and a way there (R-WORLD-006). */
  asksAt?: (string | null)[];
  /** True while an ask still says its last line after what it asked has closed (the officer's close): the sheet that holds it stays open. */
  asksHold?: boolean;
  /**
   * The world mode's phone (R-WORLD-018), handed in by the shell: the handset over the place named `area`. `toMap` puts
   * it away onto the map with a stop picked: a paper's visit in Papers (R-WORLD-019).
   */
  phone?: (close: () => void, area: string, app?: string | null, toMap?: (stop: string) => void, here?: string) => ReactNode;
  /** A dot on the Phone button: an app has something new (R-WORLD-004). */
  phoneWaiting?: boolean;
  /** The icon for an ask card's corner, by the ask's icon name, from the shell's icon set. */
  askIcon?: (name: string) => ReactNode;
  /** The world mode's map (R-WORLD-015 to 017), handed in by the shell; without it the map button opens nothing. */
  cityMap?: (props: CityMapSlot) => ReactNode;
  /** The street kiosk's sheet while the world runs the Friday draw (lottery.md R-LOTTERY-001), handed in by the shell, over the place named `label`. */
  kiosk?: (close: () => void, label: string) => ReactNode;
  /** The send-off's plane cut over the painted map at night (world.md R-WORLD-037), handed in by the shell. */
  planeCut?: (slot: PlaneCutSlot) => ReactNode;
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
  // The world opens with nothing said yet: lines from a life before are not carried into this one.
  useEffect(() => resetLines(), []);
  const addToPlan = useGame((state) => state.addToPlan);
  const plan = useGame((state) => state.plan);
  const [phone, setPhone] = useState(false);
  const endMonth = useGame((state) => state.endMonth);
  const stopPick = useGame((state) => state.stopPick);
  const beganAt = useGame((state) => state.beganAt);
  // R-WORLD-002: the band's clock is the character's age, with the month's name beside it and the world's part of the day
  // (R-CLOCK-033), moving on the device each minute; the simulation still counts months.
  const dayClock = useDayClock();
  const ageMonths = view.qualities.find((quality) => quality.id === "quality.age-months")?.value ?? 0;
  const clock = say("ui.world.clock", { years: Math.floor(ageMonths / 12), months: ageMonths % 12 });
  const [asksOpen, setAsksOpen] = useState(false);
  const [askIndex, setAskIndex] = useState(0);
  const askList = Array.isArray(asks) ? asks : null;
  const askCount = askList?.length ?? 0;
  useEffect(() => {
    if (askIndex >= askCount) setAskIndex(0);
  }, [askIndex, askCount]);
  // Over the set piece (the exam), the header counts its own questions, not the asks.
  const shownAsk = askList?.[Math.min(askIndex, Math.max(0, askCount - 1))];
  const onSetpiece = isValidElement(shownAsk) && shownAsk.key === "setpiece" ? view.setpiece : null;
  // The count is the asks still waiting: one left says no count at all.
  const header = askList === null ? null : askHeader({ left: askCount, index: askIndex, setpiece: onSetpiece });
  const askLabel = header === null ? null : say("ui.world.ask-of", header);
  // R-WORLD-008: the results are up from the month's end until the player goes back to the place; the staged wins come first.
  const resultsOpen = useGame((state) => state.reportOpen && state.moments.length === 0) && world && view.report !== null;
  const reportOpen = useGame((state) => state.reportOpen);
  // R-WORLD-008: no full-screen moment over the world; a big line (the flight, a win) is told in the corner and passes.
  const moments = useGame((state) => state.moments);
  const nextMoment = useGame((state) => state.nextMoment);
  const momentCards = useGame((state) => state.momentCards);
  useEffect(() => {
    if (!world || moments.length === 0) return;
    const line = moments[0];
    // A big line its moment card tells is not told again in the corner, and does not hold the card back (R-MOMENT-006).
    if (line !== undefined && momentCards.some((card) => sameLine(card.line, line))) {
      nextMoment();
      return;
    }
    // The party's line is told by its own beat over the full yard, not again in the corner.
    if (line !== undefined && line.key !== PARTY_SAID) tell(words(line.key, line.params));
    const timer = window.setTimeout(nextMoment, MOMENT_MS);
    return () => window.clearTimeout(timer);
    // The corner is the city's; the next big line is told once the last has led a while.
  }, [world, moments, nextMoment, momentCards]);
  // R-WORLD-025: the scene goes dark, then the results sheet (which reads the report's state itself).
  const [resultsShown, setResultsShown] = useState(false);
  useEffect(() => {
    if (!world || !reportOpen) {
      setResultsShown(false);
      return;
    }
    // R-WORLD-002: a short beat in the room first, then the cut and the results.
    const timer = window.setTimeout(() => cutTo(() => setResultsShown(true)), RESULTS_BEAT_MS);
    return () => window.clearTimeout(timer);
    // The cut runs once as the report opens.
  }, [world, reportOpen]);
  const [zoomed, setZoomed] = useState(false);
  const [diveTo, setDiveTo] = useState<string | null>(null);
  // The stop the map opens on when the nudge sends the player somewhere (R-WORLD-003).
  const [mapPick, setMapPick] = useState<string | null>(null);
  // The chapter's opening stands over the world once, before the first month is played (R-WORLD-001): the first
  // chapter's title for a moment, once per life, kept beside the save so a reload never shows it again; a later
  // chapter's card with Go (R-CHAPTER-011).
  const [openingSeen, setOpeningSeen] = useState(() => view.chapter.current !== null && view.chapter.current === FIRST_CHAPTER && wasTaught("title", view.scenario));
  // Nothing lectures before play (R-WORLD-033): the thumbs carry a word until each is tapped once.
  const firstUse = useFirstUse(view.report !== null, map);
  // The app the phone opens on when the nudge sends the player to it (the month's news).
  const [phoneApp, setPhoneApp] = useState<string | null>(null);
  // An interview with a question still to answer holds the month as a set piece does (R-INTERVIEW-004); a life over ends nothing.
  const endBlocked = view.ended ? words("reject.ended") : view.setpiece !== null || (view.interview?.question ?? null) !== null ? words("reject.setpiece-open") : null;
  /** The phone on the Calendar app: on its coming list, or on the month as it is. */
  const openCalendar = (opening: "coming" | null): void => {
    setPhoneApp(opening === null ? "calendar" : `calendar:${opening}`);
    setPhone(true);
  };
  /**
   * Sleep is a timed act from the bed, at any hour of the world's day (R-WORLD-025): the figure lies on the bed under a soft dark wash with a chip under the band,
   * and the month turns only when the sleep runs out (`due`). Held while a question waits, with the reason told in the
   * corner. `bed` is the thing slept on, for the scene's pose and its sleep mark.
   */
  const [asleep, setAsleep] = useState<{ bed: string; at: number; ms: number; due: boolean } | null>(null);
  const asleepNow = useRef(asleep);
  asleepNow.current = asleep;
  /** True from a sleep cut short until its nap's reply lands, so the nap's own line is not told over the waking. */
  const wokeNap = useRef(false);
  const sleepOn = (bed: string): void => {
    if (endBlocked !== null) {
      tell(endBlocked);
      return;
    }
    cue("tap");
    setAsleep({ bed, at: Date.now(), ms: sleepMsOf(typeof location === "undefined" ? "" : location.search), due: false });
  };
  /**
   * Waking before the sleep runs out makes it a nap (R-WORLD-025): no month turns, the nap is sent when the view allows
   * one, the wash lifts, the figure gets up and the corner says the night is still yours.
   */
  const wake = (): void => {
    const held = asleepNow.current;
    if (held === null || held.due) return;
    asleepNow.current = null;
    setAsleep(null);
    cue("tap");
    const nap = wakeCommand(view.activities);
    if (nap !== null) {
      wokeNap.current = true;
      void send(nap).then((reply) => {
        if (reply?.ok !== true) wokeNap.current = false;
      });
    }
    tell(say(wokeWords(dayClock.served ? dayClock.part : "afternoon")));
  };
  const asleepAt = asleep?.at ?? null;
  useEffect(() => {
    if (asleepAt === null) return;
    const ms = asleepNow.current?.ms ?? SLEEP_MS;
    const timer = window.setTimeout(() => setAsleep((held) => (held === null || held.at !== asleepAt ? held : { ...held, due: true })), Math.max(0, asleepAt + ms - Date.now()));
    return () => window.clearTimeout(timer);
  }, [asleepAt]);
  // The sleep ran out: the month turns (R-WORLD-025), the same command the band once sent. Never under the phone or the
  // map the player opened meanwhile: the turn waits for them to be put away, since nothing opens by itself over them.
  const turning = useRef(false);
  const sleepDue = asleep?.due === true;
  useEffect(() => {
    if (!sleepDue || phone || map || turning.current) return;
    if (endBlocked !== null) {
      tell(endBlocked);
      setAsleep(null);
      return;
    }
    turning.current = true;
    cue("tap");
    void endMonth().then((reply) => {
      turning.current = false;
      // A refused turn wakes the sleeper where they lie; a turn that lands keeps the wash until the results stand over it.
      if (reply?.ok !== true) setAsleep(null);
    });
    // The turn starts once, when the sleep is due and nothing covers the room.
  }, [sleepDue, phone, map]);
  // The results are up (or the report has gone): the night is over, the wash lifts and the figure gets up.
  useEffect(() => {
    if (resultsShown || (!reportOpen && !turning.current && asleepNow.current?.due === true)) setAsleep(null);
  }, [resultsShown, reportOpen]);
  // R-WORLD-025: the first time a life sleeps, one small card says what a night is, once per life, before the first sleep;
  // it holds the bed it was opened at.
  const [nightTeach, setNightTeach] = useState<string | null>(null);
  /** The way a vehicle in the place was tapped for, chosen on the ride sheet when the map opens from it (R-WORLD-017). */
  const [rideBy, setRideBy] = useState<RideChoice["id"] | null>(null);
  // How many times each plain act has been tapped in each place: a colleague's lines go round in turn (R-WORLD-039).
  const tapsHere = useRef(new Map<string, number>());
  const [shipped, setShipped] = useState<Set<string> | null>(null);
  const [menu, setMenu] = useState(false);
  const [credits, setCredits] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  // The act a fan's button chose, handed to the scene to walk for, and the entry walked to until its act lands (R-WORLD-010).
  const [fanAct, setFanAct] = useState<{ thing: Thing; act: Act; at: number } | null>(null);
  const fanGoing = useRef<{ thing: string; activity: string; param: string | null } | null>(null);
  // While a fan's button is pressed the band's counter shows what would be left (design page 13 section 2).
  const [bandPreview, setBandPreview] = useState<number | null>(null);
  const [fanGoingId, setFanGoingId] = useState<string | null>(null);
  // The fan's act last sent and when: the scene may report the walk's arrival twice under load, and the second must not open the act's card over an act already done.
  const fanSent = useRef<{ thing: string; activity: string; at: number } | null>(null);
  // The thing whose fan found no room beside it: its acts stand as a small sheet instead (R-WORLD-034).
  const [fanSheet, setFanSheet] = useState<string | null>(null);
  // Lines the corner tells once it shows again: a courted partner's answer waits for the home's card to be put away (R-PEOPLE-013).
  const [toTell, setToTell] = useState<string[]>([]);
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
  // Each country's words ride their own chunk (engine.md R-ENGINE-020): fetched once the life is in that country (London,
  // Calgary, Dubai, Castel Volturno), and the city drawn again once they are in, so its things' names and its people's
  // lines read in words.
  const [, setLateWords] = useState(0);
  useEffect(() => {
    if (where !== "abroad" || !hasAbroadWords(country)) return;
    let live = true;
    void loadAbroadWords(country).then(() => {
      if (live) setLateWords((count) => count + 1);
    });
    return () => {
      live = false;
    };
  }, [where, country]);
  // The game opens where the character lives (R-HOME-006): a start in Makoko opens on the water.
  const home = homeOf(view);
  const [placeId, setPlaceId] = useState<string>(() => (world ? lastPlace(here, home, dayClock.served ? dayClock.day : null) : openingPlace(here, PLACES)));
  // A new where (home, abroad, the road) opens its own hub (R-CITY-012, R-CITY-013).
  useEffect(() => {
    setPlaceId(world ? lastPlace(here, home, dayClock.served ? dayClock.day : null) : openingPlace(here, PLACES));
    // The home changes only with the where or a move; a move is the player's own and keeps the place they stand in.
  }, [here, world]);
  // A move made while standing in the home just left: the character goes to the new home, as the
  // ride home would take them, since the old room is no longer theirs and no ride starts from it.
  const homeBefore = useRef(home);
  useEffect(() => {
    const left = homeBefore.current;
    homeBefore.current = home;
    if (home === null || left === null || left === home) return;
    setPlaceId((standing) => (standing === left ? home : standing));
  }, [home]);
  useEffect(() => {
    if (!world || !drawing) return;
    let alive = true;
    void loadManifest()
      .then((manifest) => {
        if (alive) setShipped(new Set(PLACES.filter((place) => !OLD_FILES.has(place.id) && assetUrl(manifest, stageFilePath(place, (path) => assetUrl(manifest, path) !== null)) !== null).map((place) => place.id)));
      })
      .catch(() => {
        if (alive) setShipped(new Set());
      });
    return () => {
      alive = false;
    };
  }, [world, drawing]);
  // An open set piece is shown where it is staged (R-CITY-011); staged elsewhere, it waits there and the nudge says so, since the city never moves the player without a ride.
  const scene = openScene(view, PLACES);
  const sceneAt = scene?.place ?? null;
  // The city off the world (the road's) still shows the set piece where it is staged (it has no rides to get there).
  useEffect(() => {
    if (!world && sceneAt !== null) setPlaceId(sceneAt);
  }, [world, sceneAt]);
  // The place the effect below last saw: a reload opens in the room it was kept in (R-WORLD-014), and only a move to
  // another place steps back outside.
  const placeSeen = useRef(placeId);
  // A ride taken from the map while asleep leaves the bed: the sleep is cut short as a tap on the chip cuts it (R-WORLD-025).
  useEffect(() => {
    if (asleepNow.current !== null && !asleepNow.current.due) wake();
    // Only a move to another place or room wakes the sleeper.
  }, [placeId, inside]);
  useEffect(() => {
    watch.current = enterPlace(watch.current);
    if (placeSeen.current !== placeId) setInside(false);
    placeSeen.current = placeId;
    setZoomed(false);
    setPicked(null);
    setFailed(null);
    setProgress(null);
  }, [placeId]);
  useEffect(() => {
    if (!looking || world) return;
    const timer = window.setInterval(() => setHeardCount((count) => count + 1), HEARD_MS);
    return () => window.clearInterval(timer);
  }, [looking, world]);

  const entry = entryOf(placeId);
  const plainFile = usePlaceFile(entry, drawing);
  const offers = entry === null ? [] : offersHere(view, entry.id, PLACES);
  const monthLines = useGame((state) => state.monthLines);
  const partied = world && partyThrown(monthLines);
  const openKey = dressedBy(offers, partied ? monthLines : []).join("|");
  // An open offer the place stages dresses it (R-CITY-011): the party set and its guests at the family house. Their room is
  // dressed for the person whose room it is, who stands in it (R-WORLD-020); with no such bond it is the plain room.
  const roomPerson = entry?.id === THEIR_ROOM ? roomPartner(view) : null;
  // A home's car spot holds the life's car while it has one: the market's used car standing at the
  // home lived in, or a car on finance abroad.
  const livedIn = home !== null && placeId === home;
  const ownsCar = view.obligations.some((owed) => owed.car !== null) || (livedIn && view.things.drive);
  // : what is owned stands in the home lived in, at its set spot or where the player set it down.
  const standingKey = livedIn ? view.things.owned.flatMap((one) => (one.stored ? [] : [one.thing])).join("|") : "";
  const [arranged, setArranged] = useState<Arranged>(() => arrangedIn(placeId, view.scenario));
  useEffect(() => setArranged(arrangedIn(placeId, view.scenario)), [placeId, view.scenario]);
  const dressed = useMemo(
    () => (plainFile === null ? null : dressPlace(parkCar(showOwned(plainFile, standingKey === "" ? [] : standingKey.split("|"), arranged), ownsCar), openKey === "" ? [] : openKey.split("|"), roomPerson)),
    [plainFile, openKey, roomPerson, ownsCar, standingKey, arranged],
  );
  // Buy mode: in a home of your own a hold on a thing you own lifts it; never at the family house.
  const arranging = world && buyModeAt(placeId, home, standingKey === "" ? [] : standingKey.split("|"));
  const outsideFile = dressed?.file ?? null;
  // Inside, the scene is the room the place's door opens into: the file's `inside` names its folder under
  // places/, fetched with the place so the cut is quick (R-WORLD-013); the room's own file names the entry
  // it belongs to (the hub's room is place.yaba, the parlour the family house). A place that names no room
  // has one cut from its own file.
  const insideId = insideOf(outsideFile);
  const insideFile = useRoomFile(insideId, drawing);
  const insideEntry = insideId === null ? null : (entryOf(insideFile?.place ?? "") ?? PLACES.find((place) => place.assets === insideId) ?? entryOf(insideId) ?? entry);
  // The room's models are fetched and decoded while the player still stands outside, so the cut into it stays short (R-WORLD-013).
  useEffect(() => {
    if (insideFile === null || inside || !drawing) return;
    void loadManifest()
      .then((manifest) => Promise.all(filesOf(insideFile, []).map((path) => loadModel(manifest, path, (key) => text[key]))))
      .catch(() => undefined);
  }, [insideFile, inside, drawing]);
  // The world mode remembers where the player stopped and where they have been (rules 5 and 7).
  useEffect(() => {
    if (!world) return;
    // The world's day is kept with the place, so a return after the sky has turned starts at home.
    keep(LAST_KEY, [placeId, inside ? "inside" : "", ...(dayClock.served ? [String(dayClock.day)] : [])]);
    const been = readKept(BEEN_KEY);
    const here = inside && insideEntry !== null ? [placeId, insideEntry.id] : [placeId];
    const fresh = here.filter((id) => !been.includes(id));
    if (fresh.length > 0) keep(BEEN_KEY, [...been, ...fresh]);
  }, [world, placeId, inside, insideEntry]);
  // R-WORLD-029: a choice for the month is seen on its thing: what carries on in the plan, and what was done this month,
  // the pot steaming once cooked and the drum full once fetched (R-OBLIGATION-014).
  const plannedKey = plan.flatMap((pick) => (pick === null ? [] : [pick.activity])).join("|");
  // An act that repeats is never done for the month (R-ACTIVITY-019, decision 0035), so the month's own answers say it was done.
  const doneKey = [...new Set([...view.activities.flatMap((option) => (option.done ? [option.id] : [])), ...nowActsIn(monthLines)])].join("|");
  // R-WORLD-020, R-PEOPLE-009, R-PEOPLE-013: a computer partner the view lists stands at their thing in the place content
  // meets them in, one met only in December only while it is December; nobody else stands there.
  const december = useGame((state) => worldVar(state, DECEMBER)) === 1;
  const meetPlace = inside && insideEntry !== null ? insideEntry.id : placeId;
  const candidatesKey = view.people.candidates.map((candidate) => `${candidate.person}:${candidate.role}`).join("|");
  // The list is read by its key, so a new view with the same candidates keeps the place as it is.
  const standing = useMemo(() => (world ? standingAt(meetPlace, view.people.candidates, december) : []), [world, meetPlace, candidatesKey, december]);
  const file = useMemo(() => {
    const here = outsideFile === null || !inside ? outsideFile : insideId === null ? roomOf(outsideFile, HOUSE) : insideFile;
    return here === null ? null : withStanding(showPlanned(here, [...plannedKey.split("|"), ...doneKey.split("|")]), standing);
  }, [outsideFile, inside, insideId, insideFile, plannedKey, doneKey, standing]);
  useEffect(() => {
    setZoomed(false);
    setPicked(null);
  }, [inside]);
  // A wide home turns a quarter at a time and opens as it was left: the quarter kept beside the
  // save, by home, read anew for each place so the house never swings round on the way in.
  const turnable = world && !inside && file !== null && (stageOf(file).rooms?.length ?? 0) > 0 && turnsRound(shotOf(stageOf(file)));
  const [turns, setTurns] = useState<Record<string, number>>({});
  const turnQuarter = useMemo(() => turns[placeId] ?? turnIn(placeId, view.scenario), [turns, placeId, view.scenario]);
  useEffect(() => setTurns({}), [view.scenario]);
  const turnHouse = (quarter: number): void => {
    const kept = keepTurn(placeId, quarter, view.scenario);
    setTurns((was) => ({ ...was, [placeId]: kept }));
  };
  const settings = modeSettings(mode, device(), city);
  const others = useMemo<Other[]>(() => (presence !== null && presence.place === placeId ? presence.others : []), [presence, placeId]);
  const today = useMemo<Other[]>(() => (presence !== null && presence.place === placeId ? (presence.today ?? []) : []), [presence, placeId]);
  // The look is read once a life, not on every frame of the city (R-PROLOGUE-009).
  const own = useMemo(() => ownFile(view.scenario), [view.scenario]);
  // No resident wears the player's own outfit or a dancer's.
  // In the world a place shows at most the crowd its scope allows in the mode; the party keeps its ten (R-WORLD-011).
  const crowdEntry = inside && insideEntry !== null ? insideEntry : entry;
  const dressedCrowd = inside ? null : (dressed?.crowd ?? null);
  const sample = useMemo(() => {
    if (crowdEntry === null || file === null) return null;
    const standers = (stageOf(file).standing ?? []).map((stander) => stander.file);
    const drawn = sampleCrowd({ ...crowdEntry, crowd: dressedCrowd ?? crowdEntry.crowd }, poolOf(file.people.sample), date, mode, world ? crowdTuning(city, file.scope, dressedCrowd !== null) : city, others, today, [own, ...(stageOf(file).dancers ?? []).map((dancer) => dancer.file), ...standers]);
    // Someone standing at a thing of their own takes a resident's place where the room would hold more than its scope allows (R-WORLD-011).
    return { ...drawn, people: makeRoom(drawn.people, roomFor(drawn.people.length, standers.length, WORLD_LIMITS.people[file.scope][mode])) };
  }, [crowdEntry, file, dressedCrowd, date, mode, others, today, own, world]);
  const places = enterable(here, PLACES);
  const heard = entry === null ? null : overheard(view, entry.id, date, heardCount);
  const lines = entry === null ? [] : reportHere(view, entry.id, PLACES);
  const ready = progress !== null && progress.loaded >= progress.total && failed === null;
  /** The place whose first frame has been drawn. */
  const [drawnAt, setDrawnAt] = useState<string | null>(null);
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
        if (picked.command === COURT) return picked.with === undefined ? "" : nameOf(picked.with);
        if (picked.command === GO_HOME) return say("ui.world.go-home");
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
  // R-CHAPTER-012: the gate's act opens the send-off scene in place of the card the flight was; the scene's third beat sends
  // `route/depart`, so picking the act changes nothing in the life.
  useEffect(() => {
    if (!world || picked?.kind !== "command" || picked.command !== "route/depart") return;
    setPicked(null);
    const country = departDue === null ? null : (content.route[departDue]?.country ?? null);
    if (departDue === null || country === null) return;
    cue("open");
    sendOff.getState().open({ route: departDue, country });
  }, [world, picked, departDue]);
  const sendOffShowing = useSendOffShowing();
  const busy = useGame((state) => state.busy);
  // R-WORLD-005: a job on a place's board or stall is an act whenever the hunt can ask for it.
  const hunt = view.activities.find((option) => option.id === "activity.job-hunt");
  // The board stays while a job is held: the hunt's jobs show, and the card says why it is shut.
  const jobIds = hunt?.params ?? [];
  // Held funds still open are paid back at the counter through a command act (R-ROUTE-008).
  const heldDue = view.obligations.find((owed) => content.obligation[owed.entry]?.type === "held-funds") ?? null;
  // An activity shut only by a paper not yet held (the English test before the passport) still stands in the world, shut with its reason;
  // a now-act done this month is gone from its thing until the next (R-ACTIVITY-015).
  // R-LOTTERY-001: while the world runs the Friday draw the kiosk's act stays, and opens the draw's sheet.
  const activityKey = [...withKiosk(actsOffered(view), view), ...(heldDue === null ? [] : ["command:obligation/pay"]), ...(depositDue === null ? [] : ["command:route/pay-deposit"]), ...(departDue === null ? [] : ["command:route/depart"]), ...(goHomeOffered(view) ? [`command:${GO_HOME}`] : []), ...(view.ended ? [] : [`command:${COURT}`])].join("|");
  const chapterNow = view.chapter.current;
  const heldJob = view.job.id;
  const offersKey = view.offers.map((offer) => offer.entry).join("|");
  const setpieceEntry = view.setpiece?.entry ?? null;
  // The world's part of the day decides which things are open (R-CLOCK-033): the viewing centre and the joint from the evening.
  const dayPart = dayClock.served ? dayClock.part : "afternoon";
  const things = useMemo(() => {
    if (!world || file === null) return undefined;
    const offered = new Set(activityKey.split("|"));
    const staged = new Set<string>([...(entry?.stages ?? []), ...(insideEntry?.stages ?? []), ...homeStagesAt(placeId, home, here, PLACES), ...byHandAt(placeId, home, here, content.activity)]);
    // Someone standing as themselves (their room's partner) has no act, so is kept past the acts' filter: a tap shows their name (R-PEOPLE-054).
    // A job held abroad is held at its thing: the job's act there becomes the shift, its label On shift (R-WORLD-039).
    const held = onShift(withMoreAt(withMeetings(thingsOf(stageOf(file)), meetPlace, standing), meetPlace), heldJob, here.where === "abroad");
    return [...thingsNow(held, stagedNow(offered, staged, new Set(offersKey.split("|")), setpieceEntry, chapterNow), dayPart), ...standingAsThemselves(stageOf(file))];
  }, [world, file, activityKey, entry, insideEntry, placeId, offersKey, setpieceEntry, chapterNow, home, here, meetPlace, standing, dayPart, heldJob]);
  // The chosen thing's acts already in this month's plan say Planned and are shut.
  const pickedThing = picked?.kind === "thing" ? picked.thing : null;
  // R-ACTIVITY-020: an act done at once that waits for sleep says so on its fan button.
  const chosenThing = useMemo(() => (pickedThing === null ? null : withSpent(withPlanned(pickedThing, plan, view), view)), [pickedThing, plan, view]);
  // Every thing fans its acts out of itself (R-WORLD-034): the simulation's acts done at once and every other act alike.
  const fanEntries = useMemo(() => (!world || chosenThing === null ? null : fanEntriesOf(chosenThing)), [world, chosenThing]);
  const fanned = fanEntries === null ? null : chosenThing;
  // What the scene reports: a thing chosen shows its acts; an act becomes the sheet, the ride, the cut in or the cut out it stands for.
  // An act lands once the character has walked to its thing (R-WORLD-010); one that lands under a sheet, the phone, the map or the results is dropped.
  const readPick = (scenePick: ScenePick): void => {
    // A tap on the player's own figure opens nothing: it only puts away a fan,
    // as any tap outside one does, so the nudge stays (R-WORLD-003).
    if (scenePick.kind === "own") {
      setPicked(null);
      return;
    }
    if (scenePick.kind !== "act") {
      setPicked(scenePick);
      return;
    }
    const going = fanGoing.current;
    fanGoing.current = null;
    setFanGoingId(null);
    // The act walked for has landed: a scene built anew (the crowd or the mode changed) must not walk for it again.
    setFanAct(null);
    if (asksOpen || phone || map || resultsOpen) {
      setPicked(null);
      return;
    }
    const { thing, act } = scenePick;
    const sent = fanSent.current;
    if (going === null && sent !== null && sent.thing === thing.id && sent.activity === act.stages && Date.now() - sent.at < 1500) {
      setPicked(null);
      return;
    }
    // A fan's button, once the walk has reached its thing: the act is sent as its sheet's button sends it (docs/design/13-the-lively-layer.md section 3).
    if (going !== null && going.thing === thing.id && going.activity === act.stages) {
      setPicked(null);
      fanSent.current = { thing: thing.id, activity: going.activity, at: Date.now() };
      const costs = (view.activities.find((option) => option.id === going.activity)?.cost.length ?? 0) > 0;
      void actOnCard({ activity: going.activity as Id<"activity">, param: going.param }, { send, addToPlan }).then((acted) => {
        cue(acted === "answered" || acted === "planned" ? (costs ? "coin" : "done") : acted === "refused" ? "no" : "tap");
        if (acted === "full") tell(say("ui.world.full"));
      });
      return;
    }
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
        // The thing's own choice inside the entry (the kiosk's one ticket) rides along, so the act's slip opens rather than the picker (R-WORLD-005).
        setPicked(
          act.stages === undefined
            ? null
            : { kind: "action", activity: act.stages, ...(act.param === undefined ? {} : { param: act.param }), ...(act.more === undefined ? {} : { more: act.more, label: act.label }) },
        );
        return;
      case "ride": {
        // R-WORLD-017: the vehicle's act opens the same ride sheet as the map, with its way chosen.
        const vehicle = vehicleOf(thing) ?? "danfo";
        setPicked(null);
        // Abroad the stop is the bus's and the platform the train's (R-WORLD-039); in Lagos the vehicle tapped.
        setRideBy(where === "abroad" ? (act.id === "train" ? "train" : "bus") : vehicle === "keke" || vehicle === "okada" ? vehicle : "danfo");
        setMap(true);
        return;
      }
      case "enter":
        setPicked({ kind: "inside" });
        return;
      case "out":
        setPicked({ kind: "out" });
        return;
      // R-WORLD-025: the bed's Sleep is a timed act, at any hour of the world's day; the month turns when it runs out. A
      // life's first night is told once first: a life with a month behind it has slept before.
      case "end":
        setPicked(null);
        if (asleepNow.current !== null) return;
        if (view.month === 0 && !wasTaught("night", view.scenario)) {
          setNightTeach(thing.id);
          return;
        }
        sleepOn(thing.id);
        return;
      case "plain": {
        setPicked(null);
        // A person at the thing speaks over their head and what follows is told in the corner; a thing tells its line;
        // an act the scene shows (sit) says nothing.
        // A colleague says the next of their lines at each tap (R-WORLD-039), counted by place for as long as the game is open.
        const tapKey = `${placeId}:${thing.id}:${act.id}`;
        const told = tapsHere.current.get(tapKey) ?? 0;
        tapsHere.current.set(tapKey, told + 1);
        const line = plainActLine(thing, act, told);
        if (line?.kind === "say") {
          speak(line.who, line.name, line.words);
          const then = line.then;
          if (then !== null) window.setTimeout(() => tell(then), THEN_MS);
        } else if (line?.kind === "tell") tell(line.words);
        return;
      }
      // R-ROUTE-008: the school's deposit is paid at the bank through a card the world sends itself.
      case "command":
        setPicked(act.command === undefined ? null : { kind: "command", command: act.command, ...(act.with === undefined ? {} : { with: act.with }) });
        return;
      // R-WORLD-019: the papers box opens the phone's Papers app, the one place the papers are told.
      case "app":
        setPicked(null);
        setPhoneApp(act.app ?? null);
        setPhone(true);
        return;
      // R-WORLD-005: a free act that fills a slot happens at once, seen on the thing, with no line: its label says it is planned.
      case "do": {
        setPicked(null);
        const option = act.stages === undefined ? undefined : view.activities.find((candidate) => candidate.id === act.stages);
        if (option === undefined) return;
        // R-ACTIVITY-020: the body is spent; the act waits for sleep, and nothing is sent.
        if (option.spent === true) {
          tell(say("ui.act.spent"));
          return;
        }
        // R-ACTIVITY-015: an act done at once (a post from the laptop) is sent now, and the place's answer opens.
        if (answersNow(option.id)) {
          void actOnCard({ activity: option.id, param: option.params?.[0] ?? null }, { send, addToPlan }).then((acted) => cue(acted === "answered" ? "done" : "tap"));
          return;
        }
        const added = addToPlan({ activity: option.id, param: option.params?.[0] ?? null });
        cue(added ? "done" : "tap");
        const line = doActLine(added);
        if (line?.kind === "tell") tell(line.words);
        return;
      }
      default: {
        const never: never = act.kind;
        throw new Error(`Unknown act: ${String(never)}`);
      }
    }
  };
  // A fan's button that can be had: the scene walks to the thing, and the act lands in readPick once it is there (R-WORLD-010).
  // Only the simulation's acts done at once are matched on arrival and sent as their sheet's button sends them; every other
  // act lands as the thing's act it is and takes readPick's way for its kind (a pose, Sleep, a card, a command, the map).
  const fanTap = (entry: FanEntry): void => {
    if (fanned === null) return;
    // A stop takes an act carrying on out of the plan, where the thing stands; its button opens again (R-WORLD-007).
    if (entry.kind === "stop") {
      if (entry.act.stages === undefined) return;
      cue("close");
      stopPick({ activity: entry.act.stages as Id<"activity">, param: entry.act.param ?? null });
      return;
    }
    fanGoing.current = entry.kind === "now" ? { thing: fanned.id, activity: entry.id, param: entry.param } : null;
    setFanGoingId(entry.id);
    setFanAct({ thing: fanned, act: entry.act, at: Date.now() });
  };
  // No room beside the thing for its fan (section 3): the simulation's acts open as their own sheet, as before; a thing with
  // any other act opens the same buttons as a small sheet.
  const fanFallback = (): void => {
    const entries = fanEntries ?? [];
    if (fanned === null || entries.length === 0) return;
    if (!allNow(entries)) {
      setFanSheet(fanned.id);
      return;
    }
    const [first, ...rest] = entries.flatMap((one) => (one.stages === null ? [] : [{ stages: one.stages, act: one.act }]));
    if (first === undefined) return;
    setPicked(rest.length === 0 ? { kind: "action", activity: first.stages, ...(first.act.param === undefined ? {} : { param: first.act.param }) } : { kind: "action", activity: first.stages, more: rest.map((one) => one.stages), label: first.act.label });
  };
  // A new pick, or none, forgets the small sheet: the next thing tapped tries its fan first.
  useEffect(() => setFanSheet(null), [picked]);
  // A ride plays, then the place opens (rule 13).
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
    // A built place with no position of its own (an office or a clinic known by its area) stands at its area's middle, each a little apart.
    const spotted = new Map<string, number>();
    const spotOf = (place: PlaceEntry): { latE3: number; lonE3: number } => {
      if (place.position !== null) return place.position;
      // The room abroad sits off its country's hub (R-WORLD-038), never at Lagos's home spot.
      if (place.id === home) return (where === "abroad" ? roomSpot(country, PLACES, content.country) : null) ?? HOME_SPOT;
      if (place.id === FAMILY_HOUSE && where === "home") return FAMILY_SPOT;
      // Their room has no address of its own: it sits a little off the place it is near, or off home for one who is home only for December (R-WORLD-020).
      if (place.id === THEIR_ROOM) {
        const near = content.place[(roomNear(view) ?? "") as Id<"place">]?.position ?? HOME_SPOT;
        return { latE3: near.latE3 + 2, lonE3: near.lonE3 + 2 };
      }
      const area = place.area ?? "";
      const index = spotted.get(area) ?? 0;
      spotted.set(area, index + 1);
      const middle = areaSpot(area) ?? HOME_SPOT;
      return { latE3: middle.latE3 + (index % 2 === 0 ? 2 : -2) * Math.ceil(index / 2), lonE3: middle.lonE3 + 3 * index };
    };
    // A life's own first step opens its place before the chapter does (prologue.md R-PROLOGUE-010).
    const early = earlyStops(view);
    return places
      // R-WORLD-020: their room opens only once a bond is courting.
      // R-WORLD-014: the family house stays on the map for every life in Nigeria, home or not (the people met there, R-WORLD-020).
      // R-HOME-010, R-HOME-002: a rented room or the hostel stands on the map only as the home lived in, never as a stop to visit.
      .filter((place) => onMap(place.id, home))
      // R-CITY-010, R-WORLD-038: a place serving every country gives way to the country's own where they stage its entries.
      .filter((place) => place.id === home || servesHere(place, here, PLACES, content.activity))
      .filter((place) => (place.id === THEIR_ROOM ? roomOpen(view) && shipped?.has(place.id) === true : place.position !== null || place.id === home || (place.id === FAMILY_HOUSE && where === "home") || (place.area !== null && shipped?.has(place.id) === true)) && (shipped === null || shipped.has(place.id) || place.id === home || (place.id === FAMILY_HOUSE && where === "home")))
      .map((place) => {
        const reached = stopReached(view.chapter, where, place.id, early);
        const state: PinState = place.id === placeId ? "here" : place.id === home ? "home" : been.includes(place.id) ? "been" : !reached ? "not" : shipped === null || shipped.has(place.id) ? "can" : "not";
        // The room abroad by its country's name on the map and its sheet (R-WORLD-038 as amended), said short as the band says it,
        // since content's whole name ("the room in a shared flat on the Domitiana") runs off a sticker's label on a phone.
        const roomShort = `city.home.the-room.${country ?? ""}`;
        const name = place.id === "place.yaba" ? say("ui.inside.hub") : place.id === home && where === "abroad" && cityWords(roomShort) !== roomShort ? cityWords(roomShort) : placeName(place.id);
        return { id: place.id, name, state, position: spotOf(place), things: place.stages.length };
      });
  })();
  // At home the map is Lagos; abroad it is the country the character is in. The rest are shut until a visa opens them.
  const countries: CountryChoice[] = [
    { id: "lagos", name: cityWords("city.map.lagos"), locked: where === "home" ? null : cityWords("city.map.not-open") },
    ...COUNTRIES.map((id) => ({ id, name: nameOf(id), locked: where === "abroad" && id === country ? null : cityWords(where === "road" ? "city.map.not-open" : "city.map.no-visa") })),
  ];
  const shownCountry = countries.find((choice) => choice.locked === null) ?? countries[0] ?? { id: "lagos", name: cityWords("city.map.lagos"), locked: null };

  // Where the character stands, for the free step when nothing can be paid.
  const nudge = world ? nudgeOf(view, undefined, plan.flatMap((pick) => (pick === null ? [] : [pick.activity])), newsRead(view), { here: placeId, home, stops: pins }) : null;
  // A question or an offer waiting on the player opens from the nudge; nothing else is on screen to open it (R-WORLD-001).
  const nudgeOpens = asks !== undefined && (nudge?.about === "setpiece" || nudge?.about === "offer");
  // The chapter's step opens its way (R-WORLD-003): the thing's acts when it stands here, the map at its stop
  // when it is elsewhere in the city, and the Month sheet when the step is the month's end.
  // A step short of money sends the player to the jobs board, where the money is; the funds step keeps the bank.
  const shortOfMoney = nudge?.about === "step" && (nudge.key.endsWith(".short") || nudge.key === "ui.nudge.hunt-planned") && !nudge.key.startsWith("chapter.decision-day.item.held");
  const meanwhileAct = nudge?.key.startsWith("ui.nudge.meanwhile.") === true ? nudge.key.slice("ui.nudge.meanwhile.".length) : null;
  const stepWay = nudge?.about === "step" ? (nudge.way ?? (shortOfMoney || nudge.key === BETTER_JOB ? BOARD_WAY : meanwhileAct !== null ? (MEANWHILE_WAYS[meanwhileAct] ?? null) : stepWayOf(view))) : null;
  const hereId = inside ? (insideEntry?.id ?? placeId) : placeId;
  const stepThing = stepWay === null || things === undefined ? null : stepThingHere(stepWay, hereId, things);
  // Abroad the map is a list, and a stop picked on it opens its sheet all the same.
  // A result on its way is only waited for: its nudge says when it comes and opens nothing.
  // The nudge as it reads here: a step's place is not named while the player stands in it.
  const sceneAway = sceneAt !== null && sceneAt !== placeId && !(inside && insideEntry?.id === sceneAt);
  // At the world's night the nudge sends the player to bed, unless a question or a person waits (R-CLOCK-033, R-WORLD-025).
  const shownNudge = atNight(
    nudge?.about === "setpiece" && sceneAway && scene !== null
      ? { key: "ui.nudge.setpiece-away", params: { what: nameOf(scene.setpiece), place: placeName(sceneAt) }, about: "setpiece" as const }
      : nudge === null || nudge.about !== "step"
        ? nudge
        : nudgeHere(nudge, stepThing),
    dayClock.served ? dayClock.part : "afternoon",
    tired(view),
  );
  const toBed = shownNudge?.key === NIGHT;
  // The night's nudge opens the bed's fan where the bed stands; elsewhere it only says so.
  const bed = things?.find((thing) => thing.acts.some((one) => one.kind === "end")) ?? null;
  const onlyWait = nudge !== null && WAIT_ONLY.has(nudge.key);
  // A step shut by its needs says "See Japa": its tap opens the Japa app, where the needs are listed.
  const nudgeNeeds = nudge?.about === "step" && nudge.key.endsWith(".needs");
  const nudgeGoes = !onlyWait && stepWay !== null && (stepThing !== null || stepWay.go === null || where === "home" || where === "abroad");
  const followStep = (): void => {
    if (stepWay === null) return;
    const opens = stepOpen(stepWay, stepThing, view.activities.filter((option) => option.allowed).map((option) => option.id), placeId);
    switch (opens.kind) {
      case "act":
        setPicked({ kind: "action", activity: opens.activity, ...(opens.param === undefined ? {} : { param: opens.param }) });
        return;
      case "thing": {
        const thing = things?.find((candidate) => candidate.id === opens.thing);
        if (thing !== undefined) setPicked({ kind: "thing", thing });
        return;
      }
      case "month":
        openCalendar(null);
        return;
      // A paper asked for by a call or a message opens Papers on its card (R-WORLD-019).
      case "app":
        setPhoneApp(opens.act === null ? opens.app : `${opens.app}:${opens.act}`);
        setPhone(true);
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
  }, [nudgeKey, comingKey, view.month]);
  // R-ACTIVITY-015: an act done at once is answered in the place: the latest command's lines carry the speaker's line.
  const lastLines = useGame((state) => state.lines);
  const linesSeen = useRef(lastLines);
  const [answer, setAnswer] = useState<ReportLine | null>(null);
  const thingsNowHere = useRef(things);
  thingsNowHere.current = things;
  // The act done at once that landed last, so the scene plays its answer where it was done (R-WORLD-005).
  const [acted, setActed] = useState<{ activity: string; at: number } | null>(null);
  // The world's clock the last reply carried, for the scene's sun and sky (R-CLOCK-033).
  const worldClock = useGame((state) => state.clock?.world ?? null);
  useEffect(() => {
    if (linesSeen.current === lastLines) return;
    linesSeen.current = lastLines;
    const said = nowLineIn(lastLines);
    // A sleep cut short lands as a nap (R-WORLD-025): the corner has said the player is up, so the nap's own line is not told over it.
    if (said !== null && wokeNap.current && nowActOf(said) === NAP) {
      wokeNap.current = false;
      return;
    }
    // An act done from the phone is said on the phone; the sheet answers an act done in the place.
    if (!world || phone || said === null) return;
    // The scene plays the act's answer where it was done (R-WORLD-005).
    setActed({ activity: nowActOf(said), at: Date.now() });
    // R-WORLD-005: an act that repeats lands its line every time, Mama's gist over her head and the rest in the corner,
    // and its sheet goes; what the scene shows (the pot steaming, the drum full) says nothing and closes its sheet, so
    // the answer is seen on the thing.
    const lands = nowLands(said, thingsNowHere.current ?? []);
    if (lands !== null) {
      setPicked(null);
      if (lands.kind === "say") speak(lands.who, lands.name, lands.words);
      else tell(lands.words);
      return;
    }
    if (SHOWN_BY_SCENE.has(nowActOf(said))) setPicked(null);
    else setAnswer(said);
  }, [lastLines, world, phone]);
  // One action, one sheet: a paper slip for a paper thing, a card for the rest.
  const ask: Ask | null = (() => {
    if (world && answer !== null) {
      return answerAsk(kioskAnswer(answer, monthLines), { who: hereName, clock }, () => {
        cue("close");
        setAnswer(null);
        setPicked(null);
      });
    }
    // return.md: the bag in the room abroad sends the character home by choice, through a card that says what the return means.
    if (world && picked?.kind === "command" && picked.command === GO_HOME) {
      return goHomeAsk(view, {
        who: hereName,
        go: () => {
          void send({ type: GO_HOME }).then((reply) => cue(reply?.ok === true ? "whoosh" : "no"));
          setPicked(null);
        },
        dismiss: () => setPicked(null),
      });
    }
    // R-WORLD-020, R-PEOPLE-013: talking to a person met here opens their card; its one button courts them.
    if (world && picked?.kind === "command" && picked.command === COURT && picked.with !== undefined) {
      const person = picked.with;
      const partnered = (partner: string | null, name: string): string => say("ui.people.court.partnered", { partner: partner === null ? say("ui.people.who.player") : nameOf(partner), name });
      return talkAsk(person, view, content.tuning.people.maxCourting, { name: nameOf, court: (name) => say("ui.people.court", { name }), full: (count) => say("ui.people.court.full", { count }), notYet: say("ui.needs.not-yet"), computer: say("ui.people.mark.computer"), partnered }, {
        send: (who) => {
          void send({ type: "people/court", with: who }).then((reply) => {
            cue(reply?.ok === true ? "done" : "tap");
            // R-PEOPLE-013: their answer in their own words, then R-PEOPLE-054's one plain line, told in the corner once it shows.
            if (reply?.ok === true) {
              const told = courtedTold(who, { name: nameOf, answer: (one) => (hasWords(`${one}.courted`) ? say(`${one}.courted`) : null), said: (name, line) => say("ui.people.courted.said", { name, line }), chosen: (name) => say("ui.people.chosen", { name }) });
              setToTell((held) => [...held, ...told]);
            }
          });
          setPicked(null);
        },
        dismiss: () => setPicked(null),
      });
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
            if (reply?.ok === true) tell(say("ui.world.pay-back-paid"));
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
            if (reply?.ok === true) tell(say("ui.route.deposit-paid", { amount: formatMoney(school.deposit, "GBP") }));
          });
          setPicked(null);
        },
        dismiss: () => setPicked(null),
      };
    }
    // The cargo office's act opens the waybill, a paper slip (R-WORLD-006); Collect it answers the parcel.
    if (world && picked?.kind === "action" && picked.activity === PARCEL) {
      return parcelAsk(view, {
        formatMoney: (amount, currency) => formatMoney(amount, currency as "NGN"),
        done: () => setPicked(null),
        send: (offer, choice) =>
          send({ type: "offer/choose", offer: offer.id, choice }).then((reply) => {
            cue(reply?.ok === true ? "coin" : "tap");
            setPicked(null);
            if (reply?.ok === true) tell(cityWords("city.told.parcel"));
            return null;
          }),
      });
    }
    if (!world || picked?.kind !== "action" || picked.more !== undefined) return null;
    // R-LOTTERY-001: online the kiosk's tap opens the Friday draw's own sheet, never the offline slip.
    if (opensKiosk(picked.activity, view)) return null;
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
    const shut = plannedShut(plan, { activity: option.id, param: chosen ?? option.params?.[0] ?? null });
    const first = option.cost[0] ?? null;
    const cost = first === null ? null : { ...first, amount: option.cost.filter((part) => part.currency === first.currency).reduce((sum, part) => sum + part.amount, 0) };
    const paper = isPaper(activity);
    // One university to apply to: the sheet names it, its deposit and the chance, under a building.
    const school = activity === APPLY_TO_SCHOOL ? (chosen ?? (option.params?.length === 1 ? (option.params[0] ?? null) : null)) : null;
    // Chips earn their place (design page 13 section 2): the time only past a morning, at most two effects.
    const time = chipTimeOf(activity, option.halfDays);
    const does = chipEffectsLine(activity);
    return {
      form: paper ? "slip" : "card",
      icon: paper ? "ticket" : school !== null ? SCHOOL_ICON : "hand",
      who: hereName,
      // A side job on the hunt's card says it sits beside the day job and carries its own line; a job a board names carries its pay and chance.
      // A job with its own act words (the racks: "Work the fish racks") titles the card and its button with them.
      title:
        chosen !== null && hasWords(`${chosen}.act`)
          ? say(`${chosen}.act`)
          : chosen === null
            ? nameOf(activity)
            : content.activity[chosen as Id<"activity">]?.slot === "side"
              ? say("ui.world.side-job-title", { job: paramWords(chosen) })
              : `${nameOf(activity)}: ${paramWords(chosen)}`,
      line:
        chosen !== null && content.activity[chosen as Id<"activity">]?.slot === "side"
          ? [blurbOf(chosen) ?? blurbOf(activity), jobCardWords(view, chosen)].filter((part): part is string => part !== null).join(" ")
          : chosen !== null && content.activity[activity as Id<"activity">]?.param === "job"
            ? jobCardLine(view, activity, chosen)
            : chance !== null
              ? [blurbOf(activity), chance.words].filter((part): part is string => part !== null).join(" ")
              : school !== null
                ? schoolSheetLine(view, school)
                : // R-LUCK-005: past the month's ceiling the kiosk says it before it sells again.
                  activity === "activity.play-lotto" && kioskCapReached(monthLines)
                  ? words(KIOSK_CAP)
                  : // R-ACTIVITY-013: the card says what the act counts toward.
                    [blurbOf(activity), countsWords(activity)].filter((part): part is string => part !== null).join(" "),
      cost: cost === null ? null : { amount: cost.amount, currency: cost.currency },
      button: shut ? say("ui.activity.planned") : chosen !== null && hasWords(`${chosen}.act`) ? say(`${chosen}.act`) : nameOf(activity),
      // R-ACTIVITY-015: an act done at once says "Now" under its button; a month-act counts when the month ends.
      // R-ACTIVITY-018: an act done at once says the time it takes in words.
      ...(answersNow(activity) ? { when: "now" as const } : {}),
      ...(time === null ? {} : { time }),
      ...(does === null ? {} : { does }),
      // R-WORLD-006: the act's button says the act and its price.
      ...(cost === null ? {} : { priced: true as const }),
      ...(paper ? { reference: clock.toUpperCase() } : {}),
      ...(option.allowed ? {} : { blocked: needsWords(option.missing) }),
      // R-WALLET-020: a slip is paid from earned naira only; with only topped-up naira to pay it, the kiosk is shut with its words.
      ...(activity === KIOSK && cost !== null && earnedShort(view, cost.amount) ? { blocked: say("ui.lottery.earned-only") } : {}),
      // R-LUCK-005: past the month's ceiling the kiosk's button is shut with the kiosk man's line.
      ...(activity === "activity.play-lotto" && kioskCapReached(monthLines) ? { blocked: words(KIOSK_CAP) } : {}),
      // An act already in this month's plan that planning again does nothing for is shut until the month ends.
      ...(shut ? { blocked: say("ui.needs.planned") } : {}),
      // R-ACTIVITY-020: the body is spent; the sheet says so where its button was.
      ...(option.spent === true ? { spent: say("ui.act.spent") } : {}),
      act: () => {
        const pick = { activity: option.id, param: chosen ?? option.params?.[0] ?? null };
        void actOnCard(pick, { send, addToPlan }).then((acted) => {
          cue(acted === "answered" || acted === "planned" ? (cost === null ? "done" : "coin") : acted === "refused" ? "no" : "tap");
          // The place answers an act done at once in the same sheet; a refusal is said by the store. A planned act is its thing's label's state, never a line.
          if (acted === "answered") return;
          setPicked(null);
          if (acted !== "refused" && acted !== "planned") tell(say("ui.world.full"));
        });
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
  // The beat waits for the yard dressed for the party to be drawn, so its line never stands over an empty yard.
  const yardReady = !drawing || ready;
  const beatShown = partyBeat && yardReady;
  useEffect(() => {
    if (!beatShown) return;
    const timer = window.setTimeout(() => setPartyBeat(false), PARTY_BEAT_MS);
    return () => window.clearTimeout(timer);
  }, [beatShown]);
  useEffect(() => {
    if (resultsOpen) setPartyBeat(false);
  }, [resultsOpen]);
  // The results take the place of a thing's fan when the month ends; the asks sheet closes once nothing waits.
  useEffect(() => {
    if (reportOpen) setPicked(null);
  }, [reportOpen]);
  // A thing's fan, and a person's or a shopfront's card, close on a tap anywhere outside them, or on Escape (Back), so
  // the nudge they hide comes back by itself, never waiting on a tap on the floor (R-WORLD-003, R-WORLD-005; the
  // The scene reads taps on itself: another thing chooses that thing, open ground puts it away.
  const personCard = world && (picked?.kind === "person" || picked?.kind === "model");
  const chipOpen = (world && picked?.kind === "thing") || personCard;
  useEffect(() => {
    if (!chipOpen) return;
    const outside = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-card], [data-fan], [data-fan-sheet]") !== null || target.tagName === "CANVAS") return;
      setPicked(null);
    };
    const back = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setPicked(null);
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", back);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", back);
    };
  }, [chipOpen]);
  // A pick added from the picker's sheet closes the sheet, as the ask card does (R-WORLD-006); its thing's label says it is planned.
  const lastPlan = useRef(plan);
  useEffect(() => {
    const before = lastPlan.current;
    lastPlan.current = plan;
    if (!world || picked?.kind !== "action" || ask !== null) return;
    const added = plan.find((pick, index) => pick !== null && before[index] !== pick && !before.includes(pick));
    if (added === undefined || added === null) return;
    setPicked(null);
  }, [plan, world, picked, ask]);
  useEffect(() => {
    if (!nudgeOpens && asksHold !== true) setAsksOpen(false);
  }, [nudgeOpens, asksHold]);
  // A set piece's sheet opened from its thing closes once the set piece is over and its last line said.
  const setpieceOver = view.setpiece === null && asksHold !== true;
  useEffect(() => {
    if (setpieceOver && picked?.kind === "action" && picked.activity.startsWith("setpiece.")) setPicked(null);
  }, [setpieceOver, picked]);
  // R-WORLD-022: a sheet, the phone or the map opening over the world, and closing back to it.
  // The kiosk's sheet while the world runs the Friday draw (R-LOTTERY-001, R-WORLD-005).
  const kioskUp = world && picked?.kind === "action" && opensKiosk(picked.activity, view);
  const covered = world && (asksOpen || ask !== null || kioskUp || picked?.kind === "ride" || phone || map);
  // A share card up over the world (a chapter's card) keeps the street talk away from its foot.
  const cardsTurn = useCardsTurn();
  const cardClosed = useGame((state) => state.cardClosed);
  // A moment card covers the world as a share card does: the corner, the bubble and the rise wait for it (R-MOMENT-006, R-WORLD-026).
  const cardUp = world && ((cardsTurn && cardKey(view.card) !== null && cardClosed !== cardKey(view.card)) || momentCards.length > 0);
  // Japacity shown two ways (R-WORLD-029): the rise flies and the bag by the door grows once nothing covers the world, so both are seen together.
  const openingUp = !openingSeen && view.report === null && view.chapter.current !== null && !view.ended;
  const japa = useJapaRise(view.japacity.percent, world && looking && !covered && !resultsOpen && !map && !cardUp && !openingUp);
  // R-WORLD-005: the first time a place is entered in a life, every name shows over its mark for two seconds and fades;
  // once per place per life, kept beside the save. It waits for the place to be drawn and the opening title to go.
  const [teaching, setTeaching] = useState(false);
  const hasThings = things !== undefined && things.length > 0;
  useEffect(() => {
    if (!world || !ready || openingUp || !hasThings) return;
    const mark = `place:${hereId}` as const;
    if (wasTaught(mark, view.scenario)) return;
    markTaught(mark, view.scenario);
    setTeaching(true);
    const timer = window.setTimeout(() => setTeaching(false), TEACH_MS);
    return () => {
      window.clearTimeout(timer);
      setTeaching(false);
    };
  }, [world, ready, openingUp, hasThings, hereId, view.scenario]);
  // The names are due as this render commits, before the effect above has begun teaching them: the street waits for them too.
  const teachDue = world && ready && !openingUp && hasThings && !wasTaught(`place:${hereId}`, view.scenario);
  // R-HOME-008: the first entry into a home in a life shows what the home is, its blurb,
  // once, as a small card the player dismisses; kept beside the save, so it never shows again in this life.
  const homeHere = home !== null && (placeId === home || hereId === home) ? home : null;
  const [homeTeach, setHomeTeach] = useState<string | null>(null);
  useEffect(() => {
    if (!world || homeHere === null || openingUp || wasTaught(`home:${homeHere}`, view.scenario)) return;
    setHomeTeach(homeHere);
  }, [world, homeHere, openingUp, view.scenario]);
  const homeTeachShown = homeTeach !== null && homeTeach === homeHere && !covered && !resultsOpen && !cardUp && asleep === null && blurbOf(homeTeach) !== null;
  // R-WORLD-026: the corner and the bubble show only while nothing covers the world; the street's talk comes only then.
  const worldFree = world && looking && !covered && !resultsOpen && !cardUp && !beatShown;
  // What waits to be told goes to the corner once it shows: nothing covers the world and the home's card is put away.
  useEffect(() => {
    if (toTell.length === 0 || !worldFree || homeTeachShown) return;
    for (const line of toTell) tell(line);
    setToTell([]);
  }, [toTell, worldFree, homeTeachShown]);
  // Toasts that answer every tap (design page 13 sections 2 and 7): money in from something done in the world slides in
  // under the band with a picture and the figure, and a coin flies to the counter. Never at the month's turn, which the
  // results tell, and never from the phone, which tells its own.
  const money = bandMoney(view).money;
  const moneyBefore = useRef(money);
  const [moneyIn, setMoneyIn] = useState<MoneyIn | null>(null);
  useEffect(() => {
    const before = moneyBefore.current;
    moneyBefore.current = money;
    if (!world || reportOpen || phone || money <= before) return;
    const said = nowLineIn(lastLines);
    const act = said === null ? "" : nowActOf(said);
    setMoneyIn({ at: Date.now(), title: act === "" ? say("ui.toast.money-in") : nameOf(act), amount: `+${bandMoney(view).formatMoney(money - before)}`, picture: act === "" ? "activity.side-gig" : act });
  }, [money]);
  // The road in the world, only in the moment (the plan 16; design page 13 section 4). The brief of the chapter the life
  // is in; the chip for a moment after its card is handed; a done thing's toast; the close's card once a chapter closes.
  const brief = useMemo(() => (world ? briefOf(view, briefLine(view)) : null), [world, view]);
  const [handed, setHanded] = useState<string | null>(null);
  const [toast, setToast] = useState<{ words: string; at: number } | null>(null);
  const chapterBefore = useRef<PlayerView["chapter"] | null>(world ? view.chapter : null);
  useEffect(() => {
    const before = chapterBefore.current;
    chapterBefore.current = view.chapter;
    if (!world) return;
    const done = itemsDone(before, view.chapter);
    if (done.length === 0) return;
    const left = view.chapter.items.filter((item) => !item.met).length;
    if (left === 0) return;
    cue("ding");
    setToast({ words: doneToast(left), at: Date.now() });
  }, [world, view.chapter]);
  useEffect(() => {
    if (toast === null) return;
    const timer = window.setTimeout(() => setToast(null), DONE_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);
  // R-INTERVIEW-004: the last answer in, the asks leave and the officer says so in a toast under the band, in plain English.
  const [said, setSaid] = useState<Said | null>(null);
  const interviewAsking = (view.interview?.question ?? null) !== null;
  const wasAsking = useRef(interviewAsking);
  useEffect(() => {
    const before = wasAsking.current;
    wasAsking.current = interviewAsking;
    if (!world || !before || interviewAsking || view.interview === null) return;
    setAsksOpen(false);
    cue("ding");
    setSaid({ at: Date.now(), who: say("ui.interview.in.who"), words: say("ui.interview.in"), picture: "activity.interview-prep" });
  }, [world, interviewAsking]);
  // The chapters already closed when the world opened are never closed again on screen; one that closes while it is open is.
  const closedSeen = useRef(new Set<string>(view.chapter.done));
  const [closedNow, setClosedNow] = useState<string | null>(null);
  useEffect(() => {
    if (!world || closedNow !== null) return;
    const fresh = view.chapter.done.find((chapter) => !closedSeen.current.has(chapter));
    if (fresh !== undefined) setClosedNow(fresh);
  }, [world, view.chapter.done, closedNow]);
  const closeBrief = useMemo(() => (closedNow === null ? null : closedBrief(closedNow, view)), [closedNow, view]);
  const closeShown = closeBrief !== null && worldFree && !resultsShown && asleep === null;
  /** Hands the brief of the chapter the life is in: the Japa app takes a dot and the chip stands, then tucks into the phone. */
  const handOver = (chapter: string | null): void => {
    if (chapter === null || briefHanded(view.scenario, chapter)) return;
    handBrief(view.scenario, chapter);
    setHanded(chapter);
  };
  // At the step's place, or beside its person, the chip comes back with its dots and the marker stands on the thing to do;
  // never on the joint, the barber, the suya man or the club (section 4).
  const stepThingEntry = stepThing === null ? undefined : things?.find((thing) => thing.id === stepThing);
  const markable = stepThingEntry !== undefined && markerAllowed(stepThingEntry);
  const atStep = brief !== null && stepWay !== null && nudge?.about === "step" && !onlyWait && ((stepThing !== null && markable) || (stepThing === null && stepWay.go !== null && stepWay.go === hereId));
  const chipMoment = brief === null ? null : handed === brief.chapter ? ("handed" as const) : toast !== null ? ("done" as const) : atStep ? ("here" as const) : null;
  const nowItem = brief?.items.find((item) => item.now) ?? null;
  // Nothing speaks in the first seconds in a new place, so the place is seen before it is heard (the talk budget).
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    const timer = window.setTimeout(() => setSettled(true), ARRIVE_QUIET_MS);
    return () => window.clearTimeout(timer);
  }, [placeId, inside]);
  // At most three callouts over the scene (the talk budget): the fan, the road's chip and the marker come first, the bubble waits.
  const rowShown = !(phone || asksOpen || menu || credits || picked !== null || asleep !== null);
  const markerShown = atStep && stepThing !== null && markable && nowItem !== null && worldFree && fanned === null && picked === null;
  const callouts = calloutsShown({ fan: fanned !== null, chip: rowShown && chipMoment !== null, marker: markerShown, bubble: true });
  // A fan opened hushes whoever was speaking: its title and buttons would stand on their words (092).
  const fannedId = fanned?.id ?? null;
  useEffect(() => {
    if (fannedId !== null) hush();
  }, [fannedId]);
  const { speech, lines: toldLines } = useLines();
  const talking = speech !== null;
  // The first brief's card stands once the place's first frame is drawn; the chapter's close once a chapter has closed.
  const briefUp = openingUp && brief !== null && (!drawing || drawnAt === placeId);
  const closeUp = closeShown && closeBrief !== null && closedNow !== null;
  const zoomChipFree = worldFree && picked === null && fanned === null && asleep === null && nightTeach === null && !homeTeachShown && !briefUp && !closeUp && toldLines.length === 0;
  const heardNth = useRef(0);
  const thingsHere = useRef(things);
  thingsHere.current = things;
  useStreetTalk(() => {
    if (entry === null) return null;
    const heardNow = overheard(view, entry.id, date, heardNth.current);
    heardNth.current += 1;
    // A line one person plainly says names them, over their own figure where they stand in the place (R-WORLD-026).
    return heardNow === null ? null : { text: heardWords(heardNow.key, heardNow.params), ...speakerOf(heardNow, thingsHere.current ?? [], (key) => cityWords(key)) };
    // The street waits while a place's names are taught on its first entry, and while the brief's card stands: names and words
    // never share the scene (024).
  }, worldFree && settled && callouts.bubble && !homeTeachShown && !teaching && !teachDue && !briefUp, home !== null && placeId === home ? say("ui.talk.home") : undefined);
  // A person speaks only in the place they stand in: going elsewhere takes their words down.
  useEffect(() => hush(), [placeId, inside]);
  // R-WORLD-005: the light bill paid at home, Mama says so over her head, the corner tells the bill paid, and a moment later the next compound is heard.
  const lightSeen = useRef(lastLines);
  useEffect(() => {
    if (lightSeen.current === lastLines) return;
    lightSeen.current = lastLines;
    const light = world ? lightBack(lastLines, thingsHere.current ?? []) : null;
    if (light === null) return;
    speak(light.who, light.name, light.words);
    tell(light.told);
    const heard = light.heard;
    const timer = window.setTimeout(() => murmur(heard), UP_NEPA_MS);
    return () => window.clearTimeout(timer);
  }, [lastLines, world]);
  // The thing's label says what of it is planned this month (R-WORLD-005).
  const marks = useMemo(() => (things === undefined ? {} : { ...plannedMarks(things, new Set(plannedKey.split("|"))), ...shiftMarks(things, cityWords("city.thing.on-shift")) }), [things, plannedKey]);
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
              // The opening words stand alone over the dimmed world (R-WORLD-001): no thing label shows through the chapter's caption.
              labelsHidden={openingUp}
              text={(key) => text[key]}
              onProgress={(loaded, total) => setProgress({ loaded, total })}
              onFailed={setFailed}
              onPick={readPick}
              {...(world
                ? {
                    overview: true,
                    roam: ROAM,
                    ...(things === undefined ? {} : { things, marks, named: namedThings(things, stepThing), nudged: stepThing, teaching }),
                    // The fan's buttons hand their acts to walk for (R-WORLD-034).
                    actOn: fanAct,
                    onClear: () => setPicked(null),
                    zoomed,
                    onZoomed: setZoomed,
                    ...(turnable ? { turn: turnQuarter, onTurned: turnHouse } : {}),
                    acted,
                    worldClock,
                    asleep: asleep?.bed ?? null,
                    ...(arranging && !inside
                      ? {
                          arrange: {
                            onSet: (thing: string, spot: [number, number, number]) => setArranged(keepArranged(placeId, thing, spot, view.scenario)),
                            onLift: () => cue("pop"),
                            onMisfit: () => cue("no"),
                          },
                        }
                      : {}),
                  }
                : {})}
              onFrame={(frameMs) => {
                // The first frame drawn of a place: the first brief's card waits for it, so it never stands on a blank world.
                if (drawnAt !== placeId) setDrawnAt(placeId);
                const next = observeFrame(watch.current, frameMs, city);
                watch.current = next;
                if (next.mode !== mode) setMode(next.mode);
              }}
            >
              {world ? (
                <Suspense fallback={null}>
                  <Bag stage={stageOf(file)} figure={japa.figure} documents={view.documents} routes={view.routes} />
                </Suspense>
              ) : null}
            </CityScene>
          </Suspense>
        ) : null}
      </div>

      {world && sendOffShowing ? (
        <Suspense fallback={null}>
          <SendOffScene you={sendOffYou(view)} game={{ view, busy, send: (command) => send(command).then((reply) => reply?.ok === true), rejection: <Rejection /> }} {...(planeCut === undefined ? {} : { planeCut })} />
        </Suspense>
      ) : null}

      {world && map && cityMap !== undefined
        ? cityMap({
            pins,
            country: shownCountry,
            countries,
            // The ride's scene draws at home and in a country whose ways are drawn (R-WORLD-015, R-WORLD-039).
            drawing: drawing && (where === "home" || (where === "abroad" && (view.place.ways ?? []).length > 0)),
            diveTo,
            pickFirst: mapPick,
            step: stepWay?.go ?? null,
            ...(rideBy === null ? {} : { by: rideBy }),
            home,
            onGo: (id) => {
              setPlaceId(id);
              setMap(false);
              setDiveTo(null);
              setRideBy(null);
              setMapPick(null);
              tell(placeName(id));
            },
            onClose: () => {
              setMap(false);
              setDiveTo(null);
              setRideBy(null);
              setMapPick(null);
            },
            // R-PLACE-010: the fare leaves cash through the command, and the ride plays only once it is
            // accepted, at home and, since 16 Oct 2026, in a country that lists its ways; a country with none asks no fare.
            onRide: async (choice, to) => {
              if (view.place.where === "road" || (view.place.where === "abroad" && (view.place.ways ?? []).length === 0)) return true;
              const reply = await send({ type: "place/ride", from: placeId as Id<"place">, to: to as Id<"place">, way: choice.id });
              return reply?.ok === true;
            },
            // Turn back (R-WORLD-017): the first fare is gone and the character stays where they were; the simulation never moved them, so nothing more is sent.
            onTurnBack: () => {
              setMap(false);
              setDiveTo(null);
              setRideBy(null);
              setMapPick(null);
              tell(cityWords("city.ride.turned-back"));
            },
          })
        : null}

      {world && looking ? (
        <>
          {/* The room dims a little while the player sleeps (R-WORLD-025): a soft dark wash over the world, on opacity alone; it
              takes the taps meant for the room, since a sleeper does nothing until they wake. */}
          <div aria-hidden className={`fixed inset-0 z-[36] bg-device/35 transition-opacity duration-200 ease-out ${asleep === null ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"}`} data-sleep-wash={asleep === null ? "off" : "on"} />
          <Band
            when={clock}
            name={homeLine(hereId, view) ?? bandName(hereName)}
            {...bandMoney(view)}
            month={bandMonth(view, beganAt, dayClock)}
            sky={dayClock.served ? dayClock.part : "afternoon"}
            preview={fanned === null ? null : bandPreview}
            // R-QUALITY-007: the body's word beside the age, only when it complains.
            body={bodyWords(view)}
            onMonth={() => {
              cue("tap");
              openCalendar(null);
            }}
            // The band stays through the beat before the results, and steps back once they are up (R-WORLD-002).
            hidden={map || (resultsOpen && resultsShown)}
            open={bandOpen}
            {...(coming === null ? {} : { onToggle: () => setBandOpen((open) => !open) })}
            more={
              // The chip under the band and the nudge wait while the brief's card or the chapter's close stands: the card says it.
              !(phone || asksOpen || menu || credits || picked !== null || asleep !== null || briefUp || closeUp) ? (
                <div key={bandOpen ? "open" : `peek-${nudgeKey}-${comingKey}`} className={bandOpen ? "" : "drop"}>
                  {moneyIn === null ? null : <MoneyToast key={moneyIn.at} toast={moneyIn} onGone={() => setMoneyIn(null)} />}
                  {said === null ? null : <SaidToast key={said.at} said={said} onGone={() => setSaid(null)} />}
                  {brief !== null && chipMoment !== null ? (
                    <BriefChip brief={brief} moment={chipMoment} toast={chipMoment === "done" ? (toast?.words ?? null) : null} {...(chipMoment === "here" && nudgeGoes ? { onTap: followStep } : {})} onTucked={() => setHanded(null)} />
                  ) : shownNudge !== null && (STANDING_NUDGES.has(shownNudge.about) || toBed) ? (
                  <Nudge nudge={shownNudge} {...(stepWay?.opens === undefined || toBed ? {} : { opens: stepWay.opens })} {...(toBed ? (bed === null ? {} : { onTap: () => setPicked({ kind: "thing", thing: bed }) }) : nudgeOpens ? { onTap: () => setAsksOpen(true) } : nudgeNeeds ? { onTap: () => { setPhoneApp("japa"); setPhone(true); } } : nudgeGoes ? { onTap: followStep } : nudge?.about === "report" ? { onTap: () => { setPhoneApp("news"); setPhone(true); } } : nudge?.about === "dues" ? { onTap: () => { setPhoneApp("bank"); setPhone(true); } } : {})} />
                  ) : null}
                  {coming === null || !(bandOpen || (peek && !chipFolds(nudge, coming, view.month))) ? null : (
                    <button type="button" className="chip press pointer-events-auto mt-1.5 inline-flex max-w-full items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-bold" data-coming onClick={() => openCalendar("coming")} aria-label={say("ui.world.coming-up")}>
                      <Clock size={14} aria-hidden />
                      <span className="truncate">{say("ui.world.coming", { what: coming.what, when: coming.when ?? inMonths(coming.month, view.month) })}</span>
                    </button>
                  )}
                </div>
              ) : null
            }
          />
          <ThumbBar
            onMap={() => { firstUse.tap("map"); if (cityMap !== undefined) setMap(true); }}
            onPhone={() => { firstUse.tap("phone"); setPhoneApp(null); setPhone(true); }}
            phoneWaiting={phoneWaiting ?? view.offers.length > 0}
            hidden={map || resultsOpen || closeShown}
            // The house turns a quarter round from its button; it steps back while a sheet, the phone, the map or a fan is open.
            {...(turnable ? { onTurn: () => { cue("tap"); turnHouse(turnQuarter + 1); }, turnHidden: !worldFree || picked !== null || fanned !== null || asleep !== null || homeTeachShown || nightTeach !== null || openingUp } : {})}
          />
          <FirstUseLabels tapped={firstUse.tapped} hidden={map || resultsOpen || covered || openingUp || closeShown} />
          {/* "See the whole place" stands only on a free world: it steps back under a card, a sheet, a share card, the chapter's
              close, a fan, the first-night card and the sleep, and gives the foot to the corner's line while one stands. */}
          {zoomed && !map && zoomChipFree ? (
            <button type="button" onClick={() => setZoomed(false)} className="chip drop pointer-events-auto fixed bottom-[calc(max(14px,env(safe-area-inset-bottom))+76px)] left-1/2 z-[38] -translate-x-1/2 px-3 py-2 text-[13px] font-bold" data-zoom-preset>
              {say("ui.world.whole")}
            </button>
          ) : null}
          {/* A person's or a shopfront's card sits at the foot of the screen, as the sheets do, never under the band. */}
          {personCard && picked !== null ? (
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[39] px-2 pb-[max(8px,env(safe-area-inset-bottom))]" data-card-dock>
              <PersonCard picked={picked} words={cardWords()} onClose={() => setPicked(null)} />
            </div>
          ) : null}
          {/* A sleeper hears nothing: the corner keeps its lines until they wake (R-WORLD-025), and leaves Wake up clear. */}
          {/* An open fan keeps the corner clear: the fan's buttons may run down to the thumbs (docs/design/13-the-lively-layer.md section 5). */}
          <Corner hidden={!worldFree || homeTeachShown || nightTeach !== null || asleep !== null || fanned !== null} />
          {asleep !== null && !asleep.due ? (
            <>
              {/* The sleep's chip under the band, with a thin bar running down over the sleep's length; a tap on it wakes (R-WORLD-025). */}
              <div className="pointer-events-none fixed inset-x-0 top-[calc(max(10px,env(safe-area-inset-top))+80px)] z-[38] flex justify-center px-3">
                <button type="button" onClick={wake} className="brief-chip drop press pointer-events-auto relative inline-flex items-center gap-2 overflow-hidden py-1.5 pr-4 pl-1.5 text-[15px] font-bold" data-asleep>
                  <span className="chip-pic flex size-8 items-center justify-center bg-tint-body text-[17px]" aria-hidden>
                    🌙
                  </span>
                  <span>{say("ui.sleep.chip")}</span>
                  <span aria-hidden className="sleep-bar absolute inset-x-0 bottom-0 h-[3px] bg-signal" style={{ animationDuration: `${String(asleep.ms)}ms` }} data-asleep-bar />
                </button>
              </div>
              {/* Wake up, low on the right above the Phone button (in the centred column on a laptop), does as the chip does. */}
              <CentredColumn className="pointer-events-none fixed inset-x-0 bottom-[calc(max(14px,env(safe-area-inset-bottom))+76px)] z-[38] flex justify-end px-3">
                <PressButton onClick={wake} className="pop pointer-events-auto min-w-[150px]" data-wake>
                  {say("ui.sleep.wake")}
                </PressButton>
              </CentredColumn>
            </>
          ) : null}
          {nightTeach !== null ? (
            <CentredColumn className="pointer-events-none fixed inset-x-0 bottom-[calc(max(14px,env(safe-area-inset-bottom))+84px)] z-[38] px-3">
            {/* The first night's card as the after set draws it (world-first-night-card): the moon on a soft tile, a title of a
                few words, the line, Not yet and the yellow Sleep. */}
            <div className="lively-card pop pointer-events-auto mx-auto flex flex-col gap-3 p-3.5" role="note" data-night-teach>
              <div className="flex items-center gap-3">
                <span className="flex size-16 shrink-0 items-center justify-center rounded-[16px] bg-tint-body">
                  <span className="sticker-cut text-[36px] leading-none" style={{ rotate: "-8deg" }} aria-hidden>
                    🌙
                  </span>
                </span>
                <div className="min-w-0">
                  <p className="text-title leading-tight font-bold">{say("ui.night.first.title")}</p>
                  <p className="text-[16px] leading-snug text-text-2">{say("ui.night.first")}</p>
                </div>
              </div>
              <div className="flex gap-2.5">
                <button type="button" className="press flex-1 rounded-[16px] border-2 border-edge bg-sheet-2 px-4 text-[16px] font-bold shadow-[0_3px_0_var(--edge)]" onClick={() => setNightTeach(null)} data-night-teach-later>
                  {say("ui.night.first.later")}
                </button>
                <PressButton
                  className="flex-[1.4]"
                  onClick={() => {
                    markTaught("night", view.scenario);
                    setNightTeach(null);
                    sleepOn(nightTeach);
                  }}
                  data-night-teach-ok
                >
                  {say("ui.night.first.ok")}
                </PressButton>
              </div>
            </div>
            </CentredColumn>
          ) : null}
          {homeTeachShown && homeTeach !== null ? (
            <CentredColumn className="pointer-events-none fixed inset-x-0 bottom-[calc(max(14px,env(safe-area-inset-bottom))+76px)] z-[38] px-3">
            <div className="lively-card pop pointer-events-auto mx-auto flex items-start gap-2 p-3" role="note" data-home-teach={homeTeach}>
              <p className="min-w-0 flex-1 text-[14px] leading-snug">{blurbOf(homeTeach)}</p>
              <button
                type="button"
                className="press flex size-8 shrink-0 items-center justify-center rounded-[4px] text-text-2"
                aria-label={cityWords("city.home.teach.close")}
                onClick={() => {
                  markTaught(`home:${homeTeach}`, view.scenario);
                  setHomeTeach(null);
                }}
                data-home-teach-ok
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            </CentredColumn>
          ) : null}
          {/* An open fan hushes the words over the scene (the talk budget keeps nothing over an open fan). */}
          <SpeechBubble hidden={!worldFree || !callouts.bubble || fanned !== null} anchored={drawing && ready} />
          {drawing && ready && sample !== null ? <Emotes people={sample.people} hidden={!worldFree || !settled || asleep !== null || openingUp} quiet={talking} onTap={(slot) => readPick({ kind: "person", slot })} /> : null}
          {fanned !== null && fanEntries !== null && picked?.kind === "thing" ? (
            fanSheet === fanned.id ? (
              <FanSheet key={fanned.id} thing={fanned.id} title={sceneWords(fanned.label)} entries={fanModel(fanEntries, view, plan)} onAct={fanTap} onClose={() => setPicked(null)} going={fanGoingId} />
            ) : (
              <Fan key={fanned.id} thing={fanned.id} title={sceneWords(fanned.label)} {...(fanned.mark === undefined ? {} : { mark: fanned.mark })} entries={fanModel(fanEntries, view, plan)} onAct={fanTap} onFallback={fanFallback} going={fanGoingId} onPreview={setBandPreview} />
            )
          ) : null}
          <Rise rise={japa.rise} />
          {beatShown ? (
            <button type="button" onClick={() => setPartyBeat(false)} className="pop pointer-events-auto fixed inset-x-0 bottom-[calc(max(14px,env(safe-area-inset-bottom))+124px)] z-[45] flex justify-center px-6" data-party-beat>
              <span role="status" className="band rounded-[6px] px-4 py-3 text-center text-[16px] leading-snug font-bold shadow-xl">
                {words(PARTY_SAID)}
              </span>
            </button>
          ) : null}
          <Cut cutting={cutting} />
          {/* The chapter's brief is handed as a mission card by its person (design page 13 section 4; R-CHAPTER-011 as the hand
              redraws it): the first chapter's once in a life, a later chapter's until a month is played. Let's go carries it. */}
          {/* The card's wait for the first frame is marked, so the keep-this-life ask (R-ACCOUNT-023) and the suite's helpers wait with it. */}
          {openingUp && brief !== null && !briefUp ? <span data-brief-pending hidden /> : null}
          {briefUp && brief !== null ? (
            <MissionCard
              brief={brief}
              onGo={() => {
                if (view.chapter.current === FIRST_CHAPTER) markTaught("title", view.scenario);
                setOpeningSeen(true);
                handOver(view.chapter.current);
              }}
            />
          ) : null}
          {closeUp && closeBrief !== null ? (
            <ChapterClose
              brief={closeBrief}
              line={hasWords(`${closedNow}.close`) ? words(`${closedNow}.close`) : ""}
              next={brief}
              after={brief === null ? null : ((next) => (next === null ? null : { chapter: next, title: briefTitle(next) }))(brief.next?.chapter ?? nextBase(brief.chapter))}
              onGo={() => {
                closedSeen.current.add(closedNow);
                setClosedNow(null);
                handOver(view.chapter.current);
              }}
            />
          ) : null}
          {markerShown && stepThing !== null && nowItem !== null ? <Marker thing={stepThing} words={nowItem.words} picture={nowItem.picture} onTap={followStep} /> : null}
        </>
      ) : null}
      {looking ? (
        <div className="pointer-events-none fixed inset-0 z-[36] flex flex-col justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {world ? null : (
            <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-md border border-sheet-line bg-sheet p-2">
              <div className="flex min-w-0 flex-1 flex-col px-1">
                <h2 className="truncate text-xl leading-tight font-bold">{name}</h2>
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

          {/* In the world the band (shared/world/Band, 12 px from the top, a 52 px pill and its toggle) stands over this lane, so
              the lane starts under it: a place loading is a note the player can see, never one behind the band (R-CITY-018). */}
          <div className={`flex flex-col gap-2 lg:max-w-md ${world ? "mt-[72px]" : ""}`} data-notes-lane>
            {loading ? <LoadingNote place={name} percent={percent} /> : null}
            {failed === null ? null : <p className="pointer-events-auto rounded-md bg-sheet/90 px-3 py-2 text-sm text-bad">{cityWords("city.failed", { place: name })}</p>}
            {/* In the world only the band, the nudge and the two thumb buttons stand over the place (R-WORLD-001): the question, the offers and the month's lines open from the nudge, the results and the phone. */}
            {!world && scene !== null && scene.place === placeId ? (
              <div className="pointer-events-auto flex flex-col gap-2 rounded-md border border-accent bg-sheet-2 p-4 shadow-lg" data-scene={scene.setpiece}>
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
              <p key={offer} className="pointer-events-auto rounded-md border border-sheet-line bg-sheet-2 px-3 py-2 text-sm">
                {cityWords("city.offer.here", { offer: placeName(offer) })}
              </p>
            ))}
            {world || lines.length === 0 ? null : (
              <div className="pointer-events-auto flex flex-col gap-1 rounded-md border border-sheet-line bg-sheet-2 p-3 text-sm" data-report-here>
                <p className="font-semibold">{cityWords("city.report.here")}</p>
                {lines.map((line, index) => (
                  <p key={`${line.key}-${String(index)}`}>{words(line.key, line.params)}</p>
                ))}
              </div>
            )}
            {world ? null : adverts?.(placeId)}
            {world || heard === null ? null : (
              <p className="pointer-events-auto self-start rounded-md rounded-bl-sm bg-strong px-3 py-2 text-sm text-on-strong" data-overheard>
                {heardWords(heard.key, heard.params)}
              </p>
            )}
            {world || picked === null || picked.kind === "action" || picked.kind === "command" || picked.kind === "ride" || picked.kind === "enter" || picked.kind === "inside" || picked.kind === "thing" ? null : <PersonCard picked={picked} words={cardWords()} onClose={() => setPicked(null)} />}
            {world ? null : (
              <p className="pointer-events-auto self-start rounded-md bg-sheet/80 px-2 py-1 text-xs text-text-2">{cityWords("city.hold")}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="fixed top-16 right-3 z-20 flex flex-col items-end gap-1">
          <Button small onClick={() => setLooking(true)} className="bg-sheet-2/95 shadow-md">
            <MapIcon size={16} />
            {cityWords("city.look")}
          </Button>
          {loading ? <LoadingNote place={name} percent={percent} small /> : null}
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
                  className={`flex min-h-11 w-full items-center justify-between rounded-md px-3 text-left hover:bg-sheet-muted ${place.id === placeId ? "font-semibold" : ""}`}
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
      {kioskUp ? kiosk?.(() => setPicked(null), hereName) : null}
      {world && picked?.kind === "action" && ask === null && !kioskUp ? (
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
      {world && asks !== undefined ? (
        <WorldSheet
          open={asksOpen}
          onClose={() => setAsksOpen(false)}
          label={askLabel ?? hereName}
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
      {world && phone && handset !== undefined
        ? handset(
            () => {
              setPhone(false);
              setPhoneApp(null);
            },
            inside ? hereName : name,
            phoneApp,
            (stop) => {
              setPhone(false);
              setPhoneApp(null);
              setMapPick(stop);
              setMap(true);
            },
            // The Market sells only at home: the place the world shows, the room within it when inside.
            inside && insideEntry !== null ? insideEntry.id : placeId,
          )
        : null}
      <Sheet open={picked?.kind === "ride"} onOpenChange={(open) => { if (!open) setPicked(null); }} title={picked?.kind === "ride" ? cardWords() : ""} description={cityWords("city.ride.title")}>
        {picked?.kind === "ride" ? (
          <ul className="flex flex-col gap-1" aria-label={cityWords("city.ride.title")} data-ride-list>
            {[...pins.filter((pin) => pin.state === "home"), ...pins.filter((pin) => pin.state !== "home" && pin.state !== "here" && pin.state !== "not")].map((pin) => {
              const here = pins.find((candidate) => candidate.state === "here");
              return (
                <li key={pin.id}>
                  <button type="button" onClick={() => travel(pin.id)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 text-left hover:bg-sheet-muted">
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
