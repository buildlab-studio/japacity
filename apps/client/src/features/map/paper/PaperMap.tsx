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

import { useMineLit } from "../../../shared/dedication/lights";
import type { MapPin } from "../pins";
import { CardView } from "./CardView";
import type { PaperCity } from "./city";
import { fold, FOLD_MS, folded, openingCard, unfolded } from "./fold";
import { CELL } from "./draw";
import type { Point } from "./fit";
import { buildGraph, type Channel, type Graph, routeBetween, routeChannel } from "./route";
import { type Marks, type Placed, placeStops } from "./stops";
import { STRIP_H, Strip, stripFrame } from "./Strip";
import { useTiles } from "./useTiles";
import { LAGOS, PaperCityContext, usePaperCity } from "./lagos";
import type { CanoeFill } from "./LanternCanoe";
import { clampView, openFrame, openingView, type OpenView } from "./view";
import { type Canoe, type Frame, World } from "./World";

/** What a browser test reads of the map: where the stops stand, which card shows, the fold, the route and its channel. */
export interface MapProbe {
  ready: boolean;
  phase: string;
  card: string;
  stops: { id: string; state: string; card: string; at: Point }[];
  route: Point[] | null;
  channel: Channel | null;
  /** R-WORLD-036: the lantern canoe's point on the paper, when the open map draws it; never one of the stops. */
  canoe: Point | null;
}

declare global {
  interface Window {
    __map?: MapProbe;
  }
}

/** Each city's roads as a graph, built once the first time its map opens. */
const GRAPHS = new WeakMap<PaperCity, Graph>();
function graphOf(city: PaperCity): Graph {
  const kept = GRAPHS.get(city);
  if (kept !== undefined) return kept;
  const made = buildGraph(city.draw.roads);
  GRAPHS.set(city, made);
  return made;
}
const WIDE = "(min-width: 64rem)";
/** How long after a card shows its neighbours draw. */
const NEIGHBOURS_MS = 450;
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

/**
 * The part of the paper an open view shows, with a margin, in whole squares of the grain, so it changes only as a pan
 * crosses a square and the grain far off the screen is never drawn.
 */
function seen(frame: Frame, size: { width: number; height: number }): readonly [number, number, number, number] {
  const margin = 160;
  const snap = (value: number, up: boolean): number => (up ? Math.ceil(value / CELL) : Math.floor(value / CELL)) * CELL;
  return [snap(-frame.x / frame.sx - margin, false), snap(-frame.y / frame.sy - margin, false), snap((size.width - frame.x) / frame.sx + margin, true), snap((size.height - frame.y) / frame.sy + margin, true)];
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
  /** The country menu, its list opening upward (at the folded map's foot) or downward (at the top), and the close button, which this layout places. */
  country: (up: boolean) => ReactNode;
  close: ReactNode;
  /** Whether a ride sheet is up at the foot. */
  sheetUp: boolean;
  /** R-WORLD-036: the lantern canoe's glow and what its tap opens, from the shell; none, no canoe. */
  canoe?: (CanoeFill & { onOpen: () => void }) | null;
  /** The painted city drawn: Lagos, or London abroad (R-WORLD-038). */
  city?: PaperCity;
}

/** The folding map of one painted city: every part inside reads the city from the context it is handed here. */
export function PaperMap({ city = LAGOS, ...props }: PaperMapProps) {
  return (
    <PaperCityContext value={city}>
      <CityMap {...props} />
    </PaperCityContext>
  );
}

function CityMap({ pins, home, picked, step, names, onPick, country, close, sheetUp, canoe: handed = null }: Omit<PaperMapProps, "city">) {
  const city = usePaperCity();
  const tiles = useTiles();
  const wide = useMedia(WIDE);
  const still = useMedia(STILL);
  const [box, size] = useBox();
  const placed = useMemo(() => placeStops(pins.map((pin) => ({ id: pin.id, state: pin.state, position: pin.position })), city), [pins, city]);
  const byId = useMemo(() => new Map(placed.map((stop) => [stop.id, stop])), [placed]);
  const here = placed.find((stop) => stop.state === "here") ?? null;
  const pickedStop = picked === null ? null : (byId.get(picked) ?? null);
  const stepStop = step === null ? null : (byId.get(step) ?? null);
  const marks: Marks = useMemo(() => ({ home, picked, step }), [home, picked, step]);
  const homeStop = home === null ? null : (byId.get(home) ?? null);
  // R-WORLD-036: the canoe's second lantern once the account's own light is lit.
  const mine = useMineLit();
  const canoe: Canoe | null = useMemo(() => (handed === null ? null : { glow: handed.glow, onOpen: handed.onOpen, mine }), [handed, mine]);

  const [state, dispatch] = useReducer(fold, null, () => folded(openingCard({ picked: pickedStop?.card ?? null, step: stepStop?.card ?? null, here: here?.card ?? null, fallback: city.fallbackCard })));
  const open = unfolded(state);

  // A stop picked from outside the map (the stops list, the nudge's step) brings its card round.
  useEffect(() => {
    if (pickedStop !== null) dispatch({ type: "swipe", card: pickedStop.card });
  }, [pickedStop?.id]);

  const route = useMemo(() => (here === null || pickedStop === null || pickedStop.id === here.id ? null : routeBetween(graphOf(city), here.at, pickedStop.at)), [here, pickedStop, city]);
  const channel = route === null || here === null || pickedStop === null ? null : routeChannel({ open: state.phase === "open" || state.phase === "opening", wide, sameCard: here.card === pickedStop.card });

  // Ready once the cards have drawn and a frame has shown them, so a test (or a slow phone) never acts on a map still drawing.
  const [painted, setPainted] = useState(false);
  const drew = useCallback(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setPainted(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);
  // The probe a browser test reads.
  useEffect(() => {
    window.__map = { ready: painted || wide, phase: state.phase, card: state.card, stops: placed.map((stop) => ({ id: stop.id, state: stop.state, card: stop.card, at: stop.at })), route, channel, canoe: canoe === null ? null : city.canoe };
  }, [painted, wide, state.phase, state.card, placed, route, channel, canoe, city]);
  useEffect(
    () => () => {
      delete window.__map;
    },
    [],
  );

  // The open map's view: framed on the card's district when it opens.
  const [view, setView] = useState<OpenView>(() => openingView(state.card, wide, size, city));

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

  const hereName = here === null ? null : city.words((city.cards.find((card) => card.id === here.card) ?? city.cards[0])?.key ?? "");
  const stadium = byId.get("place.national-stadium")?.at ?? null;

  if (wide) {
    return (
      <div ref={box} className="paper absolute inset-0 overflow-hidden" data-paper-map="wide">
        <OpenLayer size={size} view={view} setView={setView} stops={placed} names={names} marks={marks} tiles={tiles} route={channel === "open" ? route : null} canoe={canoe} onPick={pick} onDistrict={(card) => {
          dispatch({ type: "swipe", card });
        }} />
        <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto flex max-w-[430px] items-start justify-between gap-2 p-3 pt-[max(12px,env(safe-area-inset-top))]">
          {country(false)}
          {close}
        </div>
        <CardRow current={state.card} stops={placed} names={names} marks={marks} tiles={tiles} route={channel === "card" ? route : null} lift={null} onPick={pick} sheetUp={sheetUp} onCard={(card) => {
          dispatch({ type: "swipe", card });
          const framed = city.cards.find((candidate) => candidate.id === card);
          if (framed !== undefined) setView((before) => clampView({ ...before, cx: framed.centre[0], cy: framed.centre[1] }, city.paper));
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
          setView(openingView(state.card, false, size, city));
          dispatch({ type: "tap-strip" });
        }}
        onDrag={(dy) => {
          if (state.pull === 0) setView(openingView(state.card, false, size, city));
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
        onDrawn={drew}
        hidden={state.phase !== "folded"}
        pull={state.pull}
        still={still}
        sheetUp={sheetUp}
      />
      {/* The folded map's menu stands at its foot; once the map unfolds, the open map's own menu at the top is the one. */}
      {sheetUp || open ? null : <div className="paper-country">{country(true)}</div>}
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
          canoe={canoe}
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
  current: string;
  width: number;
  height: number;
  stops: readonly Placed[];
  names: (id: string) => string;
  marks: Marks;
  tiles: ReturnType<typeof useTiles>;
  route: readonly Point[] | null;
  routeCard: string | null;
  lift: Placed | null;
  onPick: (id: string) => void;
  onSwipe: (card: string) => void;
  /** Called once the card shown and its neighbours are drawn; returns its own clean-up. */
  onDrawn: () => () => void;
  hidden: boolean;
  pull: number;
  still: boolean;
  sheetUp: boolean;
}

/** The cards, one to the screen, swiped sideways with the browser's own scroll and its snap; pager dots under them. */
function CardTrack({ current, width, height, stops, names, marks, tiles, route, routeCard, lift, onPick, onSwipe, onDrawn, hidden, pull, still, sheetUp }: TrackProps) {
  const track = useRef<HTMLDivElement>(null);
  const { cards } = usePaperCity();
  const index = cards.findIndex((card) => card.id === current);
  const cardWidth = width - 32;
  const top = 12 + STRIP_H + 8 + 26;
  const cardHeight = Math.max(200, height - top - 92);
  const settling = useRef(false);
  const mounted = useRef(false);
  const scrolled = (): void => {
    const element = track.current;
    if (element === null || settling.current) return;
    const next = Math.round(element.scrollLeft / Math.max(1, width));
    const id = cards[next]?.id;
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
  // The card shown draws at once; its neighbours a moment later, so opening the map costs one card's drawing.
  const [near, setNear] = useState(false);
  useEffect(() => {
    setNear(false);
    const later = window.setTimeout(() => setNear(true), NEIGHBOURS_MS);
    return () => window.clearTimeout(later);
  }, [index]);
  useEffect(() => (near ? onDrawn() : undefined), [near, onDrawn]);
  return (
    <>
      <div
        ref={track}
        className="paper-track"
        style={{ top: `calc(${String(top)}px + env(safe-area-inset-top))`, height: cardHeight + 16, opacity: shown, transform: hidden ? "translateY(48px)" : `translateY(${String(Math.round((pull * 48) / 100))}px)`, pointerEvents: hidden ? "none" : undefined }}
        onScroll={scrolled}
        data-track
      >
        {cards.map((card, at) => (
          <div key={card.id} className="paper-slot" style={{ width }}>
            <CardView
              card={card}
              width={cardWidth}
              height={cardHeight}
              drawn={at === index || (near && Math.abs(at - index) <= 1)}
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
          {cards.map((card) => (
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
  canoe: Canoe | null;
  onPick: (id: string) => void;
  onDistrict: (card: string) => void;
  frame?: Frame | undefined;
  transition?: string | undefined;
  opacity?: number | undefined;
}

/** The open map: the whole painted map, dragged to pan, pinched or wheeled to zoom; a tap on a district picks its card. */
function OpenLayer({ size, view, setView, stops, names, marks, tiles, route, canoe, onPick, onDistrict, frame, transition, opacity }: LayerProps) {
  const city = usePaperCity();
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const down = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const pinch = useRef<number | null>(null);
  const own = openFrame(view, size.width, size.height);
  const shown = frame ?? own;
  // The paper drawn round the view changes only as a pan crosses a square of the grain: kept by its numbers, the drawing
  // is not redrawn on every frame of the unfolding or of a pan (the open map ends its unfolding crisp on a busy phone).
  const [x0, y0, x1, y1] = seen(own, size);
  const within = useMemo(() => [x0, y0, x1, y1] as const, [x0, y0, x1, y1]);
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
      if (last !== null) setView((current) => clampView({ ...current, z: (current.z * gap) / Math.max(1, last) }, city.paper));
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
    setView((current) => clampView({ ...current, cx: current.cx - dx / current.z, cy: current.cy - dy / current.z }, city.paper));
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
    onDistrict(city.cardOf(city.fromPaper([Math.round(x), Math.round(y)])));
  };
  const wheel = (event: ReactWheelEvent<HTMLDivElement>): void => {
    setView((current) => clampView({ ...current, z: current.z * (1 - event.deltaY * 0.0015) }, city.paper));
  };
  return (
    <div className="paper-open" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onWheel={wheel} style={{ opacity }} data-open-map>
      <World variant="open" uid="open" frame={shown} within={within} stops={stops} names={names} marks={marks} tiles={tiles} pinPx={36} route={route} canoe={canoe} onPick={onPick} style={transition === undefined ? undefined : { transition }} />
    </div>
  );
}

interface UnfoldProps extends Omit<LayerProps, "frame" | "transition" | "opacity"> {
  state: ReturnType<typeof folded>;
  stripWidth: number;
  still: boolean;
  onSettled: () => void;
  country: (up: boolean) => ReactNode;
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
  // Once the unfolding moves, the head row and the stickers fade in over its last part (paper.css .paper-arriving), so
  // the open map stands whole when the motion ends, whenever the fold is told it has settled.
  const arriving = !still && state.phase === "opening" && grown;
  const hidden = state.phase !== "open" && !arriving;
  return (
    <div
      className={`paper-unfold ${still ? "paper-fade" : ""} ${hidden ? "paper-moving" : ""} ${arriving ? "paper-arriving" : ""}`}
      style={{ opacity, transition: still ? `opacity ${String(FOLD_MS)}ms ease` : undefined }}
      onTransitionEnd={(event) => {
        if (moving && event.propertyName === "transform" && (event.target as HTMLElement).dataset.frame !== undefined) onSettled();
      }}
      data-unfold={state.phase}
    >
      <div className="paper-frame" style={{ transform: `translate(${String(outer.x)}px, ${String(outer.y)}px) scale(${String(outer.sx)}, ${String(outer.sy)})`, transition: motion }} data-frame>
        <OpenLayer {...layer} size={size} frame={paper} transition={motion} />
      </div>
      <div className="paper-open-head" style={{ opacity: hidden ? 0 : 1 }} data-open-head>
        {country(false)}
        {close}
      </div>
    </div>
  );
}

interface RowProps {
  current: string;
  stops: readonly Placed[];
  names: (id: string) => string;
  marks: Marks;
  tiles: ReturnType<typeof useTiles>;
  route: readonly Point[] | null;
  lift: Point | null;
  onPick: (id: string) => void;
  onCard: (card: string) => void;
  sheetUp: boolean;
}

/** On a laptop: the card shown and its two neighbours as a row at the foot, the one shown raised with a yellow edge. */
function CardRow({ current, stops, names, marks, tiles, route, lift, onPick, onCard, sheetUp }: RowProps) {
  const { cards } = usePaperCity();
  const index = cards.findIndex((card) => card.id === current);
  const row = [cards[index - 1], cards[index], cards[index + 1]].filter((card) => card !== undefined);
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
