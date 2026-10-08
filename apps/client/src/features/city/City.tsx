// The city (docs/rules/city.md): a full-screen scene under the panels, brought in front of them by
// "Look around". It reads the view and never changes it: entering a place, walking and tapping are
// this screen's own state, and nothing here sends a command (R-CITY-001). The 3D scene is loaded
// only where WebGL exists, so the panels never wait for it (R-CITY-018).
import { content, text } from "@japacity/content";
import type { Id, PlaceEntry } from "@japacity/sim";
import { Map as MapIcon, Settings2, X } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { loadJson, loadManifest } from "../../shared/three/manifest";
import { Button } from "../../shared/ui/Button";
import { Sheet } from "../../shared/ui/Sheet";
import { words } from "../../shared/words/text";
import { cityWords, heardWords, placeName, residentName, roleWords } from "./city.words";
import { CreditsSheet } from "./Credits";
import { localDate, type Other, poolOf, sampleCrowd } from "./crowd";
import { type Device, enterPlace, keepChoice, type Mode, type ModeChoice, modeSettings, observeFrame, readChoice, startingMode, watchFrames } from "./mode";
import { overheard } from "./overheard";
import { openGround, type PlaceFile } from "./placeFile";
import { personOfLook } from "./roster";
import type { Picked } from "./scene.types";
import { enterable, offersHere, openingPlace, openScene, reportHere } from "./staging";

const CityScene = lazy(() => import("./CityScene"));

const city = content.tuning.city;
const PLACES = Object.values(content.place);
/** How long a line overheard stays before the next is heard. */
const HEARD_MS = 9000;
const FALLBACK_OWN = "shared/chr/chr_tunde.glb";

/** The presence sample the online store keeps (R-CITY-015); absent offline. */
interface PresenceSample {
  place: string;
  others: { name: string | null; look: string }[];
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

export function City() {
  const view = useView();
  const presence = useGame((state) => (state as { presence?: PresenceSample | null }).presence ?? null);
  const drawing = useMemo(canDraw, []);
  const [date] = useState(() => localDate(new Date()));
  const [looking, setLooking] = useState(false);
  const [menu, setMenu] = useState(false);
  const [credits, setCredits] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [heardCount, setHeardCount] = useState(0);
  const [choice, setChoice] = useState<ModeChoice>(() => readChoice(storage()));
  const [mode, setMode] = useState<Mode>(() => startingMode(device(), city, choice));
  const watch = useRef(watchFrames(mode, choice !== "auto"));

  const where = view.place.where;
  const country = view.place.country;
  const here = useMemo(() => ({ where, country }), [where, country]);
  const [placeId, setPlaceId] = useState<string>(() => openingPlace(here, PLACES));
  // A new where (home, abroad, the road) opens its own hub (R-CITY-012, R-CITY-013).
  useEffect(() => {
    setPlaceId(openingPlace(here, PLACES));
  }, [here]);
  // An open set piece is shown where it is staged (R-CITY-011).
  const scene = openScene(view, PLACES);
  const sceneAt = scene?.place ?? null;
  useEffect(() => {
    if (sceneAt !== null) setPlaceId(sceneAt);
  }, [sceneAt]);
  useEffect(() => {
    watch.current = enterPlace(watch.current);
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
  const file = usePlaceFile(entry, drawing);
  const settings = modeSettings(mode, device(), city);
  const others = useMemo<Other[]>(() => (presence !== null && presence.place === placeId ? presence.others : []), [presence, placeId]);
  const sample = useMemo(() => (entry === null || file === null ? null : sampleCrowd(entry, poolOf(file.people.sample), date, mode, city, others)), [entry, file, date, mode, others]);
  const own = ownFile(view.scenario);
  const places = enterable(here, PLACES);
  const heard = entry === null ? null : overheard(view, entry.id, date, heardCount);
  const lines = entry === null ? [] : reportHere(view, entry.id, PLACES);
  const offers = entry === null ? [] : offersHere(view, entry.id, PLACES);
  const ready = progress !== null && progress.loaded >= progress.total && failed === null;
  const name = entry === null ? "" : placeName(entry.id);

  const choose = (next: ModeChoice): void => {
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
        const shown = sample.people.find((person) => person.slot === picked.slot);
        if (shown === undefined) return "";
        if (shown.kind === "player") return shown.tag === null ? cityWords("city.card.stranger") : cityWords("city.card.player", { name: shown.tag });
        return cityWords("city.card.resident", { name: residentName(shown.person.sex, placeId, date, shown.slot), role: roleWords(shown.person.role) });
      }
      case "model": {
        const signs = picked.signs.map((key) => text[key] ?? "").filter((said) => said.trim() !== "");
        return signs.length === 0 ? name : signs.map((said) => said.replace(/\n/g, " ")).join(". ");
      }
      default: {
        const never: never = picked;
        throw new Error(`Unknown pick: ${JSON.stringify(never)}`);
      }
    }
  };

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
              onFrame={(frameMs) => {
                const next = observeFrame(watch.current, frameMs, city);
                watch.current = next;
                if (next.mode !== mode) setMode(next.mode);
              }}
            />
          </Suspense>
        ) : null}
      </div>

      {looking ? (
        <div className="pointer-events-none fixed inset-0 z-[36] flex flex-col justify-between gap-3 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
            {heard === null ? null : (
              <p className="pointer-events-auto self-start rounded-2xl rounded-bl-sm bg-ink px-3 py-2 text-sm text-paper" data-overheard>
                {heardWords(heard.key, heard.params)}
              </p>
            )}
            {picked === null ? null : <PersonCard picked={picked} words={cardWords()} onClose={() => setPicked(null)} />}
            <p className="pointer-events-auto self-start rounded-lg bg-paper/80 px-2 py-1 text-xs text-muted">{cityWords("city.hold")}</p>
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
    </>
  );
}
