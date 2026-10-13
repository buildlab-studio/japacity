// The folding map of Lagos (docs/rules/world.md R-WORLD-015, R-WORLD-017; the second design): one painted map at two
// zooms with the strip as the hinge. Folded, the strip sits at the top and the neighbourhood cards swipe sideways
// beneath it with pager dots; a tap on the strip or a drag down unfolds the whole map (the strip's frame grows to the
// screen while the card slides down and fades, transform and opacity only, under 300 ms; a fade under reduced motion);
// a tap on a district or a pin of the open map folds it back while that neighbourhood's card rises. On a laptop both
// zooms fit at once: the open map fills the screen and the cards sit as a row at its foot. A tap on a sticker picks the
// stop; the route runs on the card within a neighbourhood and on the strip or the open map across the city.
import "./paper.css";

import type { PointerEvent as ReactPointerEvent, ReactNode, WheelEvent as ReactWheelEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";

import type { MapPin } from "../pins";
import { mapWords } from "../map.words";
import { CardView } from "./CardView";
import { CARD_IDS, CARDS, type CardId, cardById, cardIndex, cardOf } from "./districts";
import { fold, FOLD_MS, folded, openingCard, unfolded } from "./fold";
import { fromPaper, PAPER, type Point } from "./fit";
import { buildGraph, type Channel, routeBetween, routeChannel } from "./route";
import { type Marks, type Placed, placeStops } from "./stops";
import { STRIP_H, Strip, stripFrame } from "./Strip";
import { useTiles } from "./useTiles";
import { type Frame, World } from "./World";

/** What a browser test reads of the map: where the stops stand, which card shows, the fold, the route and its channel. */
export interface MapProbe {
  ready: boolean;
  phase: string;
  card: CardId;
  stops: { id: string; state: string; card: CardId; at: Point }[];
  route: Point[] | null;
  channel: Channel | null;
}

declare global {
  interface Window {
    __map?: MapProbe;
  }
}

const GRAPH = buildGraph();
/** The open map's zoom on a phone, and how far a pinch may take it. */
const OPEN_ZOOM = 0.92;
const WIDE_ZOOM = 1.3;
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 2.6;
const WIDE = "(min-width: 64rem)";
const STILL = "(prefers-reduced-motion: reduce)";

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof matchMedia === "function" && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const list = matchMedia(query);
    const change = (): void => setMatches(list.matches);
    change();
    list.addEventListener("change", change);
    return () => list.removeEventListener("change", change);
  }, [query]);
  return matches;
}

/** A box's size, kept up to date. */
function useBox(): [React.RefObject<HTMLDivElement | null>, { width: number; height: number }] {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: typeof innerWidth === "number" ? innerWidth : 390, height: typeof innerHeight === "number" ? innerHeight : 844 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const read = (): void => {
      const box = element.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) setSize({ width: Math.round(box.width), height: Math.round(box.height) });
    };
    read();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}

/** The open map's view: the paper point in the middle and the zoom. */
interface OpenView {
  cx: number;
  cy: number;
  z: number;
}

/**
 * The open map's first look from a card: the district a little up and to the left of the middle, so the lagoon, its
 * bridge and the island come into the same look as where the player was.
 */
function openingView(card: CardId, wide = false): OpenView {
  const framed = cardById(card);
  // A laptop's screen is wide: it takes the district closer, the lagoon and the island beside it.
  return wide ? clampView({ cx: framed.centre[0] + 90, cy: framed.centre[1] + 110, z: WIDE_ZOOM }) : clampView({ cx: framed.centre[0] + 70, cy: framed.centre[1] + 150, z: OPEN_ZOOM });
}

function clampView(view: OpenView): OpenView {
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, view.z));
  return { cx: Math.min(PAPER.width, Math.max(0, view.cx)), cy: Math.min(PAPER.height, Math.max(0, view.cy)), z };
}

function openFrame(view: OpenView, width: number, height: number): Frame {
  return { x: width / 2 - view.z * view.cx, y: height / 2 - view.z * view.cy, sx: view.z, sy: view.z };
}

function mix(a: Frame, b: Frame, share: number): Frame {
  return { x: a.x + (b.x - a.x) * share, y: a.y + (b.y - a.y) * share, sx: a.sx + (b.sx - a.sx) * share, sy: a.sy + (b.sy - a.sy) * share };
}

export interface PaperMapProps {
  pins: readonly MapPin[];
  home: string | null;
  picked: string | null;
  /** The place the live step points to, or null. */
  step: string | null;
  names: (id: string) => string;
  onPick: (id: string) => void;
  /** The country menu and the close button, which this layout places. */
  country: ReactNode;
  close: ReactNode;
  /** Whether a ride sheet is up at the foot. */
  sheetUp: boolean;
}

export function PaperMap({ pins, home, picked, step, names, onPick, country, close, sheetUp }: PaperMapProps) {
  const tiles = useTiles();
  const wide = useMedia(WIDE);
  const still = useMedia(STILL);
  const [box, size] = useBox();
  const placed = useMemo(() => placeStops(pins.map((pin) => ({ id: pin.id, state: pin.state, position: pin.position }))), [pins]);
  const byId = useMemo(() => new Map(placed.map((stop) => [stop.id, stop])), [placed]);
  const here = placed.find((stop) => stop.state === "here") ?? null;
  const pickedStop = picked === null ? null : (byId.get(picked) ?? null);
  const stepStop = step === null ? null : (byId.get(step) ?? null);
  const marks: Marks = useMemo(() => ({ home, picked, step }), [home, picked, step]);
  const homeStop = home === null ? null : (byId.get(home) ?? null);

  const [state, dispatch] = useReducer(fold, null, () => folded(openingCard({ picked: pickedStop?.card ?? null, step: stepStop?.card ?? null, here: here?.card ?? null, fallback: "ojuelegba" })));
  const open = unfolded(state);

  // A stop picked from outside the map (the stops list, the nudge's step) brings its card round.
  useEffect(() => {
    if (pickedStop !== null) dispatch({ type: "swipe", card: pickedStop.card });
  }, [pickedStop?.id]);

  const route = useMemo(() => (here === null || pickedStop === null || pickedStop.id === here.id ? null : routeBetween(GRAPH, here.at, pickedStop.at)), [here, pickedStop]);
  const channel = route === null || here === null || pickedStop === null ? null : routeChannel({ open: state.phase === "open" || state.phase === "opening", wide, sameCard: here.card === pickedStop.card });

  // The probe a browser test reads.
  useEffect(() => {
    window.__map = { ready: true, phase: state.phase, card: state.card, stops: placed.map((stop) => ({ id: stop.id, state: stop.state, card: stop.card, at: stop.at })), route, channel };
  }, [state.phase, state.card, placed, route, channel]);
  useEffect(
    () => () => {
      delete window.__map;
    },
    [],
  );

  // The open map's view: framed on the card's district when it opens.
  const [view, setView] = useState<OpenView>(() => openingView(state.card, wide));

  const pick = useCallback(
    (id: string) => {
      const stop = byId.get(id);
      if (stop !== undefined && !wide && (state.phase === "open" || state.phase === "opening")) dispatch({ type: "tap-district", card: stop.card });
      if (stop !== undefined && wide) {
        dispatch({ type: "swipe", card: stop.card });
      }
      onPick(id);
    },
    [byId, onPick, state.phase, wide],
  );

  const hereName = here === null ? null : mapWords(cardById(here.card).key);
  const stadium = byId.get("place.national-stadium")?.at ?? null;

  if (wide) {
    return (
      <div ref={box} className="paper absolute inset-0 overflow-hidden" data-paper-map="wide">
        <OpenLayer size={size} view={view} setView={setView} stops={placed} names={names} marks={marks} tiles={tiles} route={channel === "open" ? route : null} onPick={pick} onDistrict={(card) => {
          dispatch({ type: "swipe", card });
        }} />
        <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto flex max-w-[430px] items-start justify-between gap-2 p-3 pt-[max(12px,env(safe-area-inset-top))]">
          {country}
          {close}
        </div>
        <CardRow current={state.card} stops={placed} names={names} marks={marks} tiles={tiles} route={channel === "card" ? route : null} lift={null} onPick={pick} sheetUp={sheetUp} onCard={(card) => {
          dispatch({ type: "swipe", card });
          const framed = cardById(card);
          setView((before) => clampView({ ...before, cx: framed.centre[0], cy: framed.centre[1] }));
        }} />
      </div>
    );
  }

  const stripWidth = size.width - 24;
  return (
    <div ref={box} className="paper absolute inset-0 overflow-hidden" data-paper-map="phone" data-fold={state.phase}>
      <Strip
        width={stripWidth}
        stops={placed}
        home={homeStop?.id ?? null}
        step={stepStop?.id ?? null}
        hereName={hereName}
        stadium={stadium}
        route={channel === "strip" ? route : null}
        tiles={tiles}
        onTap={() => {
          setView(openingView(state.card));
          dispatch({ type: "tap-strip" });
        }}
        onDrag={(dy) => {
          if (state.pull === 0) setView(openingView(state.card));
          dispatch({ type: "drag", dy });
        }}
        onRelease={() => dispatch({ type: "release" })}
      />
      <div className="paper-close">{close}</div>
      <CardTrack
        current={state.card}
        width={size.width}
        height={size.height}
        stops={placed}
        names={names}
        marks={marks}
        tiles={tiles}
        route={channel === "card" ? route : null}
        routeCard={here?.card ?? null}
        lift={sheetUp && pickedStop !== null ? pickedStop : null}
        onPick={pick}
        onSwipe={(card) => dispatch({ type: "swipe", card })}
        hidden={state.phase !== "folded"}
        pull={state.pull}
        still={still}
        sheetUp={sheetUp}
      />
      {sheetUp ? null : <div className="paper-country">{country}</div>}
      {open ? (
        <Unfold
          state={state}
          size={size}
          stripWidth={stripWidth}
          view={view}
          setView={setView}
          still={still}
          stops={placed}
          names={names}
          marks={marks}
          tiles={tiles}
          route={channel === "open" ? route : null}
          onPick={pick}
          onDistrict={(card) => dispatch({ type: "tap-district", card })}
          onSettled={() => dispatch({ type: "settled" })}
          country={country}
          close={close}
        />
      ) : null}
    </div>
  );
}

interface TrackProps {
  current: CardId;
  width: number;
  height: number;
  stops: readonly Placed[];
  names: (id: string) => string;
  marks: Marks;
  tiles: ReturnType<typeof useTiles>;
  route: readonly Point[] | null;
  routeCard: CardId | null;
  lift: Placed | null;
  onPick: (id: string) => void;
  onSwipe: (card: CardId) => void;
  hidden: boolean;
  pull: number;
  still: boolean;
  sheetUp: boolean;
}

/** The cards, one to the screen, swiped sideways with the browser's own scroll and its snap; pager dots under them. */
function CardTrack({ current, width, height, stops, names, marks, tiles, route, routeCard, lift, onPick, onSwipe, hidden, pull, still, sheetUp }: TrackProps) {
  const track = useRef<HTMLDivElement>(null);
  const index = cardIndex(current);
  const cardWidth = width - 32;
  const top = 12 + STRIP_H + 8 + 26;
  const cardHeight = Math.max(200, height - top - 92);
  const settling = useRef(false);
  const mounted = useRef(false);
  const scrolled = (): void => {
    const element = track.current;
    if (element === null || settling.current) return;
    const next = Math.round(element.scrollLeft / Math.max(1, width));
    const id = CARD_IDS[next];
    if (id !== undefined && id !== current) onSwipe(id);
  };
  const latest = useRef(scrolled);
  latest.current = scrolled;
  // The card shown follows the state: a swipe sets the state, and a pick or a fold back scrolls the track. A swipe made
  // while the track was still moving there is read once it has settled.
  useEffect(() => {
    const element = track.current;
    if (element === null) return;
    const left = index * width;
    if (Math.abs(element.scrollLeft - left) < 2) {
      mounted.current = true;
      return;
    }
    settling.current = true;
    // The first card is there at once; later ones slide round, unless the track is out of sight or motion is reduced.
    const smooth = mounted.current && !still && !hidden;
    mounted.current = true;
    if (typeof element.scrollTo === "function") element.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
    else element.scrollLeft = left;
    // Settled once the track stands on the card (a long slide takes longer than a short one), or after two seconds.
    let waited = 0;
    let done = 0;
    const settle = (): void => {
      waited += 1;
      if (Math.abs(element.scrollLeft - left) >= 2 && waited < 16) {
        done = window.setTimeout(settle, 120);
        return;
      }
      settling.current = false;
      latest.current();
    };
    done = window.setTimeout(settle, 120);
    return () => {
      clearTimeout(done);
      settling.current = false;
    };
  }, [index, width, still, hidden]);
  const shown = hidden ? 0 : 1 - pull / 100;
  return (
    <>
      <div
        ref={track}
        className="paper-track"
        style={{ top: `calc(${String(top)}px + env(safe-area-inset-top))`, height: cardHeight + 16, opacity: shown, transform: hidden ? "translateY(48px)" : `translateY(${String(Math.round((pull * 48) / 100))}px)`, pointerEvents: hidden ? "none" : undefined }}
        onScroll={scrolled}
        data-track
      >
        {CARDS.map((card, at) => (
          <div key={card.id} className="paper-slot" style={{ width }}>
            <CardView
              card={card}
              width={cardWidth}
              height={cardHeight}
              drawn={Math.abs(at - index) <= 1}
              stops={stops}
              names={names}
              marks={marks}
              tiles={tiles}
              route={card.id === routeCard ? route : null}
              lift={lift !== null && lift.card === card.id ? lift.at : null}
              onPick={onPick}
              current={card.id === current}
            />
          </div>
        ))}
      </div>
      {sheetUp ? null : (
        <div className="paper-pager" style={{ top: `calc(${String(top + cardHeight + 18)}px + env(safe-area-inset-top))`, opacity: shown }} aria-hidden data-pager>
          {CARDS.map((card) => (
            <i key={card.id} className={card.id === current ? "on" : ""} />
          ))}
        </div>
      )}
    </>
  );
}

interface LayerProps {
  size: { width: number; height: number };
  view: OpenView;
  setView: (update: (before: OpenView) => OpenView) => void;
  stops: readonly Placed[];
  names: (id: string) => string;
  marks: Marks;
  tiles: ReturnType<typeof useTiles>;
  route: readonly Point[] | null;
  onPick: (id: string) => void;
  onDistrict: (card: CardId) => void;
  frame?: Frame | undefined;
  transition?: string | undefined;
  opacity?: number | undefined;
}

/** The open map: the whole painted map, dragged to pan, pinched or wheeled to zoom; a tap on a district picks its card. */
function OpenLayer({ size, view, setView, stops, names, marks, tiles, route, onPick, onDistrict, frame, transition, opacity }: LayerProps) {
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const down = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const pinch = useRef<number | null>(null);
  const own = openFrame(view, size.width, size.height);
  const shown = frame ?? own;
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    down.current = { x: event.clientX, y: event.clientY, moved: false };
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const before = pointers.current.get(event.pointerId);
    if (before === undefined || down.current === null) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      if (a === undefined || b === undefined) return;
      const gap = Math.hypot(a.x - b.x, a.y - b.y);
      const last = pinch.current;
      if (last !== null) setView((current) => clampView({ ...current, z: (current.z * gap) / Math.max(1, last) }));
      pinch.current = gap;
      down.current.moved = true;
      return;
    }
    if (Math.hypot(event.clientX - down.current.x, event.clientY - down.current.y) > 6) {
      if (!down.current.moved) if (typeof event.currentTarget.setPointerCapture === "function") event.currentTarget.setPointerCapture(event.pointerId);
      down.current.moved = true;
    }
    if (!down.current.moved) return;
    const dx = event.clientX - before.x;
    const dy = event.clientY - before.y;
    setView((current) => clampView({ ...current, cx: current.cx - dx / current.z, cy: current.cy - dy / current.z }));
  };
  const pointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const was = down.current;
    if (pointers.current.size === 0) down.current = null;
    if (was === null || was.moved || event.type === "pointercancel") return;
    // A tap on the paper itself, not a sticker: the district under it.
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left - own.x) / own.sx;
    const y = (event.clientY - rect.top - own.y) / own.sy;
    onDistrict(cardOf(fromPaper([Math.round(x), Math.round(y)])));
  };
  const wheel = (event: ReactWheelEvent<HTMLDivElement>): void => {
    setView((current) => clampView({ ...current, z: current.z * (1 - event.deltaY * 0.0015) }));
  };
  return (
    <div className="paper-open" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onWheel={wheel} style={{ opacity }} data-open-map>
      <World variant="open" uid="open" frame={shown} stops={stops} names={names} marks={marks} tiles={tiles} pinPx={36} route={route} onPick={onPick} style={transition === undefined ? undefined : { transition }} />
    </div>
  );
}

interface UnfoldProps extends Omit<LayerProps, "frame" | "transition" | "opacity"> {
  state: ReturnType<typeof folded>;
  stripWidth: number;
  still: boolean;
  onSettled: () => void;
  country: ReactNode;
  close: ReactNode;
}

/**
 * The unfolding: the open map starts where the strip is, folded, and grows to its own frame (or fades in, under reduced
 * motion); folding back it shrinks into the strip again. A drag on the strip holds it part way.
 */
function Unfold({ state, size, stripWidth, still, onSettled, country, close, ...layer }: UnfoldProps) {
  const { width, height } = size;
  // The strip's paper box on the screen: inside its white card, at the top of the screen.
  const box = { x: 16, y: 16, width: Math.max(1, stripWidth - 8), height: STRIP_H };
  const strip = stripFrame(box.width);
  // The frame starts as the strip's box and grows to the screen; inside it, the paper starts folded as the strip shows it
  // (the strip's frame undone by the box's own squeeze) and opens to the open map's view. Both move on transform alone.
  const across = box.width / Math.max(1, width);
  const down = box.height / Math.max(1, height);
  const shut: Frame = { x: box.x, y: box.y, sx: across, sy: down };
  const whole: Frame = { x: 0, y: 0, sx: 1, sy: 1 };
  const inner: Frame = { x: strip.x / across, y: strip.y / down, sx: strip.sx / across, sy: strip.sy / down };
  const own = openFrame(layer.view, width, height);
  const [grown, setGrown] = useState(state.phase === "open");
  // The fold settles when its motion ends (or, should the end never come, a little after the motion's time).
  useLayoutEffect(() => {
    if (state.phase === "opening") {
      const frame = requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)));
      const done = setTimeout(onSettled, still ? FOLD_MS + 20 : FOLD_MS + 240);
      return () => {
        cancelAnimationFrame(frame);
        clearTimeout(done);
      };
    }
    if (state.phase === "closing") {
      setGrown(false);
      const done = setTimeout(onSettled, still ? FOLD_MS + 20 : FOLD_MS + 240);
      return () => clearTimeout(done);
    }
    // Open is open, whether or not a slow frame let the motion run.
    if (state.phase === "open") setGrown(true);
    return undefined;
  }, [state.phase]);
  const pulling = state.phase === "folded";
  const share = still ? 1 : pulling ? state.pull / 100 : grown ? 1 : 0;
  const outer = mix(shut, whole, share);
  const paper = mix(inner, own, share);
  const moving = !still && !pulling && state.phase !== "open";
  const motion = moving ? `transform ${String(FOLD_MS)}ms cubic-bezier(0.2, 0.9, 0.25, 1)` : undefined;
  const opacity = still ? (grown || state.phase === "open" ? 1 : 0) : 1;
  return (
    <div
      className={`paper-unfold ${still ? "paper-fade" : ""} ${state.phase === "open" ? "" : "paper-moving"}`}
      style={{ opacity, transition: still ? `opacity ${String(FOLD_MS)}ms ease` : undefined }}
      onTransitionEnd={(event) => {
        if (moving && event.propertyName === "transform" && (event.target as HTMLElement).dataset.frame !== undefined) onSettled();
      }}
      data-unfold={state.phase}
    >
      <div className="paper-frame" style={{ transform: `translate(${String(outer.x)}px, ${String(outer.y)}px) scale(${String(outer.sx)}, ${String(outer.sy)})`, transition: motion }} data-frame>
        <OpenLayer {...layer} size={size} frame={paper} transition={motion} />
      </div>
      <div className="paper-open-head" style={{ opacity: state.phase === "open" ? 1 : 0 }}>
        {country}
        {close}
      </div>
    </div>
  );
}

interface RowProps {
  current: CardId;
  stops: readonly Placed[];
  names: (id: string) => string;
  marks: Marks;
  tiles: ReturnType<typeof useTiles>;
  route: readonly Point[] | null;
  lift: Point | null;
  onPick: (id: string) => void;
  onCard: (card: CardId) => void;
  sheetUp: boolean;
}

/** On a laptop: the card shown and its two neighbours as a row at the foot, the one shown raised with a yellow edge. */
function CardRow({ current, stops, names, marks, tiles, route, lift, onPick, onCard, sheetUp }: RowProps) {
  const index = cardIndex(current);
  const row = [CARDS[index - 1], CARDS[index], CARDS[index + 1]].filter((card) => card !== undefined);
  if (sheetUp) return null;
  return (
    <div className="paper-row" data-card-row>
      {row.map((card) => (
        <CardView
          key={card.id}
          card={card}
          width={300}
          height={210}
          drawn
          stops={stops}
          names={names}
          marks={marks}
          tiles={tiles}
          route={route}
          lift={lift}
          onPick={onPick}
          current={card.id === current}
          className={card.id === current ? "raised" : ""}
          onCard={() => onCard(card.id)}
        />
      ))}
    </div>
  );
}
