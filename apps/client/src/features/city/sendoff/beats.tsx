// The six beats as pictures (docs/rules/chapter.md R-CHAPTER-012): each one screen, drawn with the
// game's own stickers (the published tiles), its words handed in, and one yellow button. Nothing here reads the game:
// the scene (SendOffScene.tsx) hands each beat its words and its acts, and the development preview hands it a fixture.
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";

import { assetUrl, loadManifest } from "../../../shared/three/manifest";
import type { Seat } from "../../../shared/world/sendOff";
import { say } from "../../../shared/words/text";
import { sendOffWords } from "../sendOff.words";
import type { Cast, Landing } from "./plan";

/** The stage the pages are drawn at; the scene scales it to the screen, whole, centred. */
export const STAGE = { width: 390, height: 844 } as const;

/** The stage's scale for a screen of `width` by `height`: the whole page in view, never cropped. */
export function stageScale(width: number, height: number): number {
  return Math.min(width / STAGE.width, height / STAGE.height);
}

/** The scale for this window, following it as it turns or resizes. */
export function useStageScale(): number {
  const read = () => (typeof window === "undefined" ? 1 : stageScale(window.innerWidth, window.innerHeight));
  const [scale, setScale] = useState(read);
  useEffect(() => {
    const follow = () => setScale(read());
    window.addEventListener("resize", follow);
    return () => window.removeEventListener("resize", follow);
  }, []);
  return scale;
}

/** A file published under public/assets, by its path, or null until the manifest is read or when it is not published. */
function usePublished(path: string): string | null {
  const [url, setUrl] = useState<{ path: string; url: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    void loadManifest()
      .then((manifest) => {
        if (alive) setUrl({ path, url: assetUrl(manifest, path) });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [path]);
  return url !== null && url.path === path ? url.url : null;
}

/** Who the character is in the scene: the name, the look in their own colours (the city hands the figure in), the money on the band. */
export interface Dress {
  /** The name the world's band shows. */
  name: string;
  /** The first name the stub carries. */
  first: string;
  /** The age as the band says it. */
  age: string;
  look: string;
  /** The character's whole figure, in their own colours where they chose them (R-PROLOGUE-015), drawn by the city. */
  figure: ReactNode;
  cast: Cast;
  money: string;
}

/** A published tile as a die-cut sticker. Silent to a screen reader: the words carry the meaning. */
function Pic({ model, className = "", style }: { model: string; className?: string; style?: CSSProperties }) {
  const src = usePublished(`tiles/${model}.png`);
  return src === null ? null : <img src={src} alt="" draggable={false} className={`so-abs so-sticker ${className}`} style={style} data-so-tile={model} />;
}

/** One of the family or the hall as a sticker: the look standing, or cheering with both hands up (the wave). */
function Person({ look, pose = "figure", className = "", style }: { look: string; pose?: "figure" | "cheer"; className?: string; style?: CSSProperties }) {
  return <Pic model={`${look}-${pose}`} className={className} {...(style === undefined ? {} : { style })} />;
}

/** The character, in their own colours where they chose them (R-PROLOGUE-015). */
function You({ dress, className = "", style }: { dress: Dress; className?: string; style?: CSSProperties }) {
  return (
    <span className={`so-abs so-sticker ${className}`} style={style} data-so-you>
      {dress.figure}
    </span>
  );
}

function Band({ dress, place }: { dress: Dress; place: string }) {
  return (
    <div className="so-band" aria-hidden data-so-band>
      <span className="face">{dress.name.slice(0, 1).toUpperCase()}</span>
      <span className="who">
        <b>{dress.name}</b>
        <span data-so-place>
          <span className="age">{dress.age}</span> · {place}
        </span>
      </span>
      <span className="money" data-so-money>
        {dress.money}
      </span>
    </div>
  );
}

/** The world's two thumbs, drawn: the scene decides nothing with them. The Phone carries the pings' count on beat 6. */
function Thumbs({ badge = null, dot = false }: { badge?: number | null; dot?: boolean }) {
  return (
    <>
      <span className="so-thumb map" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="#1c2a5e" strokeWidth="2">
          <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
          <path d="M9 4v14M15 6v14" />
        </svg>
        {sendOffWords("sendoff.map")}
      </span>
      <span className="so-thumb phone" data-so-phone={badge ?? (dot ? "dot" : "")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#1c2a5e" strokeWidth="2" aria-hidden>
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <path d="M11 18h2" />
        </svg>
        <span aria-hidden>{sendOffWords("sendoff.phone")}</span>
        {badge === null ? null : (
          <span className="so-badge" data-so-badge={badge}>
            <span aria-hidden>{badge}</span>
            <span className="sr-only">{sendOffWords("sendoff.phone.pings", { count: badge })}</span>
          </span>
        )}
        {badge === null && dot ? <span className="so-dot" aria-hidden /> : null}
      </span>
    </>
  );
}

/**
 * A line said in a bubble with the speaker's name on it. Its tail points down at the speaker, `tail` pixels in from the
 * bubble's left edge (near its right corner with `right` and no `tail`), or from its left side at a speaker beside it.
 */
function Bubble({ name, words, right = false, side = false, tail, className = "", style, mark }: { name: string; words: string; right?: boolean; side?: boolean; tail?: number; className?: string; style?: CSSProperties; mark?: string }) {
  const aimed = tail === undefined ? style : ({ ...style, "--so-tail": `${String(tail)}px` } as CSSProperties);
  const corner = tail === undefined && right ? "right" : "";
  return (
    <p className={`so-bubble so-pop ${corner} ${side ? "side" : ""} ${className}`} style={aimed} data-so-said={mark}>
      <span className="name">{name}</span>
      {words}
    </p>
  );
}

/** The one yellow button. */
function Go({ children, onClick, disabled = false, mark }: { children: ReactNode; onClick: () => void; disabled?: boolean; mark: string }) {
  return (
    <button type="button" className="so-btn" onClick={onClick} disabled={disabled} data-so-go={mark}>
      {children}
    </button>
  );
}

/** The quiet way out before the plane (R-CHAPTER-012: leaving before beat 3 leaves the life at the airport). */
function Leave({ onLeave }: { onLeave: () => void }) {
  return (
    <button type="button" className="so-leave" onClick={onLeave} data-so-leave>
      {sendOffWords("sendoff.not-yet")}
    </button>
  );
}

export interface Said {
  name: string;
  words: string;
  who: "mum" | "dad" | "cousin" | "you";
}

/** A sticker's box on the stage: where it stands and how wide; a person's picture is twice as tall as it is wide. */
export interface Box {
  left: number;
  top: number;
  width: number;
}

/**
 * The lane at the foot of the hall, the counter and the gate: the yellow button, Not yet and the two thumbs stand on it,
 * under the scene, and no person of the scene reaches into it (R-CHAPTER-012 (k)).
 */
export const LANE_TOP = 664;

/**
 * The hall (beat 1), laid out at one scale (R-CHAPTER-012 (k)): the clerks behind the three counters small with
 * distance, the queue in front of counter 4 at one size, the character the queue's last, and the family behind the rope
 * nearest, each standing clear of the lane. The queue's places run back to the counter: the first is at it.
 */
export const HALL = {
  deskTop: 266,
  clerks: [
    { left: 50, top: 214, width: 56 },
    { left: 198, top: 214, width: 56 },
    { left: 300, top: 214, width: 56 },
  ],
  places: [
    { left: 104, top: 236, width: 84 },
    { left: 158, top: 268, width: 84 },
    { left: 212, top: 300, width: 84 },
  ],
  family: {
    mum: { left: 28, top: 476, width: 88 },
    dad: { left: 152, top: 470, width: 92 },
    cousin: { left: 272, top: 480, width: 86 },
  },
} as const satisfies { deskTop: number; clerks: readonly Box[]; places: readonly Box[]; family: Readonly<Record<"mum" | "dad" | "cousin", Box>> };

/**
 * Where each speaker's bubble stands in the hall. The family's hang from a fixed foot over their own heads, so a longer
 * line grows upward over the floor and never down over a face; the character's stands beside her at the counter, its
 * tail on its side, clear of the clerks behind.
 */
const HALL_BUBBLE: Readonly<Record<Said["who"], { style: CSSProperties; tail?: number; side?: boolean }>> = {
  mum: { style: { left: 18, bottom: 844 - 466, width: 210 }, tail: HALL.family.mum.left + HALL.family.mum.width / 2 - 18 - 8 },
  cousin: { style: { left: 156, bottom: 844 - 470, width: 220 }, tail: HALL.family.cousin.left + HALL.family.cousin.width / 2 - 156 - 8 },
  dad: { style: { left: 104, bottom: 844 - 460, width: 220 }, tail: HALL.family.dad.left + HALL.family.dad.width / 2 - 104 - 8 },
  you: { style: { left: HALL.places[0].left + HALL.places[0].width + 4, top: 274, maxWidth: 190 }, side: true },
};

/** How a queue's member stands after `step` taps: moved up to its place now, or gone to the counter's side once served. */
function queued(own: number, step: number, flip = false): CSSProperties {
  const from = HALL.places[own] ?? HALL.places[0];
  const at = own - step;
  const to = HALL.places[Math.max(0, at)] ?? HALL.places[0];
  const mirror = flip ? " scaleX(-1)" : "";
  const gone = at < 0;
  return {
    left: from.left,
    top: from.top,
    width: from.width,
    zIndex: 2 + own,
    opacity: gone ? 0 : 1,
    transform: `translate(${String(to.left - from.left - (gone ? 48 : 0))}px, ${String(to.top - from.top)}px)${mirror}`,
  };
}

/** Beat 1: Departures. The queue moves one place a tap; one of the family speaks a line a tap; the character's line last. */
export function Departures({ dress, step, said, onStep, onLeave, waiting }: { dress: Dress; step: number; said: Said; onStep: () => void; onLeave: () => void; waiting: boolean }) {
  const ahead = Math.max(0, 2 - step);
  const marker = step >= 3 ? sendOffWords("sendoff.queue.front") : ahead === 0 ? sendOffWords("sendoff.queue.next") : sendOffWords("sendoff.queue.ahead", { count: ahead });
  // Two ahead and the character last: each tap the one at the counter is served and the rest step up a place.
  const moved = Math.min(step, 2);
  const you = queued(2, moved);
  const bubble = HALL_BUBBLE[said.who];
  return (
    <div className="so-beat so-in" data-so-beat="departures" data-so-step={step}>
      <div className="so-hall-wall">
        <span className="win" style={{ left: 14, width: 90 }} />
        <span className="win" style={{ left: 118, width: 90 }} />
        <span className="win" style={{ left: 222, width: 90 }} />
        <span className="win" style={{ left: 326, width: 60 }} />
      </div>
      <Pic model="prop_flight-board" style={{ right: 6, top: 104, width: 120 }} />
      {HALL.clerks.map((clerk, index) => (
        <Person key={index} look={index === 1 ? dress.cast.clerk : dress.cast.desks[index === 0 ? 0 : 1]} className="so-clerk-far" style={{ ...clerk, zIndex: 0, transform: index === 2 ? "scaleX(-1)" : undefined }} />
      ))}
      <div className="so-counters" style={{ top: HALL.deskTop }}>
        {[3, 4, 5].map((n, index) => (
          <span key={n} className="sign" style={{ left: 36 + index * 125 }}>
            {sendOffWords("sendoff.counter.desk", { n })}
          </span>
        ))}
      </div>
      <div className="so-floor" style={{ top: HALL.deskTop + 56 }} />
      <Person look={dress.cast.ahead[0]} className="so-queue" style={queued(0, moved)} />
      <Person look={dress.cast.ahead[1]} className="so-queue" style={queued(1, moved, true)} />
      <You dress={dress} className="so-queue" style={you} />
      <Pic model="prop_travel-bag" className="so-queue" style={{ ...you, left: (you.left as number) + 66, top: (you.top as number) + 112, width: 62, zIndex: 4 }} />
      <p className="so-marker" style={{ top: 92 }} data-so-marker>
        {marker}
      </p>
      <span className="so-post" style={{ left: 18 }} />
      <span className="so-post" style={{ left: 360 }} />
      <span className="so-rope" />
      <Person look={dress.cast.mum} style={{ ...HALL.family.mum, zIndex: 6 }} />
      <Person look={dress.cast.dad} style={{ ...HALL.family.dad, zIndex: 6 }} />
      <Person look={dress.cast.cousin} style={{ ...HALL.family.cousin, transform: "scaleX(-1)", zIndex: 6 }} />
      <Bubble key={`${String(step)}-${said.who}`} name={said.name} words={said.words} style={{ ...bubble.style, zIndex: 8 }} {...(bubble.tail === undefined ? {} : { tail: bubble.tail })} side={bubble.side === true} mark={said.who} />
      {said.who === "mum" ? (
        <span className="so-emote" style={{ left: 330, top: 452 }} aria-hidden>
          ...
        </span>
      ) : null}
      <div className="so-lane" style={{ top: LANE_TOP }} />
      <Band dress={dress} place={sendOffWords("sendoff.band.departures")} />
      <Go onClick={onStep} disabled={waiting} mark="step">
        {sendOffWords("sendoff.step")}
      </Go>
      <Leave onLeave={onLeave} />
      <Thumbs />
    </div>
  );
}

/**
 * The counter (beat 2), close (R-CHAPTER-012 (k)): the character in front of the desk and the officer behind it,
 * further away and so smaller, his head no higher than hers, the Window and Aisle chips above his head.
 */
export const COUNTER = {
  deskTop: 420,
  you: { left: 20, top: 300, width: 150 },
  clerk: { left: 236, top: 316, width: 104 },
  seats: { right: 26, top: 242, height: 38 },
} as const;

/** Beat 2: the counter. The passport and the stub slide across; Window or aisle changes the stub's seat letter only. */
export function Counter({ dress, flight, to, seat, seatWords, onSeat, onTake, onLeave }: { dress: Dress; flight: string; to: string; seat: Seat; seatWords: string; onSeat: (seat: Seat) => void; onTake: () => void; onLeave: () => void }) {
  return (
    <div className="so-beat so-in" data-so-beat="counter">
      <div className="so-desk-wall" />
      <p className="so-desk-sign">{sendOffWords("sendoff.counter.desk", { n: 4 })}</p>
      <div className="so-clerk" style={{ left: COUNTER.clerk.left, top: COUNTER.clerk.top, width: COUNTER.clerk.width, height: COUNTER.deskTop - COUNTER.clerk.top }} data-so-clerk>
        <Person look={dress.cast.clerk} style={{ left: 0, top: 0, width: COUNTER.clerk.width, position: "relative" }} />
      </div>
      <div className="so-desk" style={{ top: COUNTER.deskTop }} />
      <div className="so-desk-floor" style={{ top: COUNTER.deskTop + 150 }} />
      <You dress={dress} style={{ ...COUNTER.you, zIndex: 2 }} />
      <Pic model="prop_travel-bag" style={{ left: 52, top: 560, width: 110, zIndex: 2 }} />
      <div className="so-passport so-slide-l" style={{ left: 188, top: 372, rotate: "-9deg" }} aria-hidden data-so-passport>
        {sendOffWords("sendoff.passport")}
        <div className="seal" />
        {sendOffWords("sendoff.passport.word")}
      </div>
      <div className="so-stub so-slide-r" style={{ left: 138, top: 470, rotate: "4deg" }} data-so-stub>
        <div className="k">{say("share.stub.kicker").toUpperCase()}</div>
        <div className="r">
          <span className="big">
            {say("share.stub.home")} {"→"} {to}
          </span>
        </div>
        <div className="r">
          <span className="s">{dress.first.toUpperCase()}</span>
          <span className="s" data-so-seat={seat}>
            {seatWords}
          </span>
        </div>
        <div className="cut" />
      </div>
      <Bubble name={sendOffWords("sendoff.counter.by")} words={sendOffWords("sendoff.counter.ask")} right style={{ right: 18, top: 160, maxWidth: 190 }} mark="counter" />
      <div className="so-seat" style={{ right: COUNTER.seats.right, top: COUNTER.seats.top }} role="group" aria-label={sendOffWords("sendoff.counter.ask")} data-so-seats>
        {(["window", "aisle"] as const).map((which) => (
          <button key={which} type="button" aria-pressed={seat === which} onClick={() => onSeat(which)} data-so-seat-chip={which}>
            {sendOffWords(`sendoff.seat.${which}`)}
          </button>
        ))}
      </div>
      <p className="so-chip money" style={{ left: 16, top: 222 }} data-so-flight>
        <span className="tick" aria-hidden>
          {"✓"}
        </span>
        {flight}
      </p>
      <div className="so-lane" style={{ top: LANE_TOP }} />
      <Band dress={dress} place={sendOffWords("sendoff.band.departures")} />
      <Go onClick={onTake} mark="take">
        {sendOffWords("sendoff.take")}
      </Go>
      <Leave onLeave={onLeave} />
      <Thumbs />
    </div>
  );
}

/**
 * The gate (beat 3), laid out so the family waving stand above the lane and Board the plane sits under them, never over
 * their bodies (R-CHAPTER-012 (k)); Papa's bubble hangs over the door's side with its tail at his raised hands, clear of
 * his head.
 */
export const GATE = {
  door: { left: 112, top: 214, width: 166, height: 250 },
  you: { left: 150, top: 256, width: 100 },
  family: {
    mum: { left: 16, top: 448, width: 96 },
    dad: { left: 146, top: 440, width: 100 },
    cousin: { left: 280, top: 456, width: 92 },
  },
  papa: { left: 12, bottom: 844 - 424, width: 172 },
} as const;

/** Beat 3: the gate. The plane in the window, the family waving, Papa's line; Board the plane sends the flight. */
export function Gate({ dress, city, papa, board, blocked, busy, rejection, onBoard, onLeave }: { dress: Dress; city: string; papa: { name: string; words: string }; board: string; blocked: string | null; busy: boolean; rejection: ReactNode; onBoard: () => void; onLeave: () => void }) {
  return (
    <div className="so-beat so-in" data-so-beat="gate">
      <div className="so-gate-wall" />
      <div className="so-gate-window" />
      <svg className="so-gate-plane" viewBox="0 0 100 60" aria-hidden>
        <g fill="#f3efe6" stroke="#1c2a5e" strokeWidth="1.2">
          <path d="M4 30 Q4 26 10 26 L86 26 Q98 27 98 30 Q98 33 86 34 L10 34 Q4 34 4 30 Z" />
          <path d="M50 27 L30 2 L40 2 L64 27 Z" />
          <path d="M50 33 L30 58 L40 58 L64 33 Z" />
          <path d="M12 27 L2 14 L9 14 L22 27 Z" />
          <path d="M12 33 L2 46 L9 46 L22 33 Z" />
        </g>
      </svg>
      <div className="so-door" style={GATE.door} />
      <p className="so-gate-sign">{sendOffWords("sendoff.gate.sign", { city: city.toUpperCase() })}</p>
      <div className="so-gate-floor" style={{ top: GATE.door.top + GATE.door.height }} />
      <You dress={dress} style={{ ...GATE.you, zIndex: 2 }} />
      <Pic model="prop_travel-bag" style={{ left: 226, top: 384, width: 60, zIndex: 2 }} />
      <Person look={dress.cast.mum} pose="cheer" className="so-wave" style={{ ...GATE.family.mum, zIndex: 3 }} />
      <Person look={dress.cast.dad} pose="cheer" className="so-wave" style={{ ...GATE.family.dad, zIndex: 3, animationDelay: "0.15s" }} />
      <Person look={dress.cast.cousin} pose="cheer" className="so-wave" style={{ ...GATE.family.cousin, zIndex: 3, animationDelay: "0.3s" }} />
      <Bubble name={papa.name} words={papa.words} style={GATE.papa} tail={GATE.family.dad.left - GATE.papa.left - 8} mark="dad" />
      <div className="so-lane" style={{ top: LANE_TOP }} />
      <Band dress={dress} place={sendOffWords("sendoff.band.gate")} />
      {blocked === null ? null : (
        <p className="so-blocked" role="status" data-so-blocked>
          {blocked}
        </p>
      )}
      {rejection}
      <Go onClick={onBoard} disabled={busy || blocked !== null} mark="board">
        {board}
      </Go>
      <Leave onLeave={onLeave} />
      <Thumbs />
    </div>
  );
}

/** Beat 4: the plane, the map's own layer handed in (world.md R-WORLD-037). */
export function Plane({ cut }: { cut: ReactNode }) {
  return (
    <div className="so-beat" data-so-beat="plane">
      {cut}
    </div>
  );
}

/** The staple pulling in at the stop (beat 5): London's red double-decker, the Domitiana bus, the pickup, the cream taxi. */
function StapleAtStop({ landing, blind }: { landing: Landing; blind: string }) {
  switch (landing.staple) {
    case "double-decker":
      return (
        <div className="so-bus so-pull-in" data-so-staple="double-decker">
          <div className="body" />
          <div className="blind" data-so-blind>
            {blind}
          </div>
          <div className="no" aria-hidden>
            N
          </div>
          {[18, 84, 150, 216].map((left) => (
            <span key={`u${String(left)}`} className="win" style={{ left, top: 52, width: 58, height: 40 }} />
          ))}
          {[18, 84, 150].map((left) => (
            <span key={`d${String(left)}`} className="win" style={{ left, top: 118, width: 58, height: 44 }} />
          ))}
          <span className="door" />
          <span className="light" />
          <span className="wheel" style={{ left: 40 }} />
          <span className="wheel" style={{ right: 48 }} />
        </div>
      );
    case "domitiana-bus":
      return (
        <div className="so-bus single so-pull-in" data-so-staple="domitiana-bus">
          <div className="body" />
          <div className="stripe" />
          <div className="blind" data-so-blind>
            {blind}
          </div>
          {[18, 84, 150].map((left) => (
            <span key={left} className="win" style={{ left, top: 48, width: 58, height: 22 }} />
          ))}
          <span className="door" />
          <span className="light" />
          <span className="wheel" style={{ left: 40 }} />
          <span className="wheel" style={{ right: 48 }} />
        </div>
      );
    case "pickup":
      return (
        <div className="so-pickup so-pull-in" data-so-staple="pickup">
          <span className="bed" />
          <span className="cab" />
          <span className="glass" />
          <span className="snowcap" />
          <span className="light" />
          <span className="wheel" style={{ left: 22 }} />
          <span className="wheel" style={{ left: 170 }} />
        </div>
      );
    case "taxi":
      return (
        <span data-so-staple="taxi">
          <Pic model="veh_taxi-dubai" className="so-pull-in" style={{ left: 20, top: 300, width: 250, zIndex: 2 }} />
        </span>
      );
    default: {
      const never: never = landing.staple;
      throw new Error(`Unknown staple ${String(never)}`);
    }
  }
}

/** Snow falling, drawn as flakes: small white dots scattered the same way every time (no soft gradient, R-WORLD-021). */
function Snow({ count = 46 }: { count?: number }) {
  return (
    <div className="so-snow" aria-hidden data-so-snow>
      {Array.from({ length: count }, (_, index) => {
        const left = (index * 53) % 390;
        const top = (index * 97) % 844;
        const size = 3 + (index % 4);
        return <span key={index} className="so-flake" style={{ left, top, width: size, height: size }} />;
      })}
    </div>
  );
}

/** A Calgary house drawn small in the kit's flat dress: a box, a pitched roof with snow on it, a lit window. */
function House({ left, top, tint }: { left: number; top: number; tint: string }) {
  return (
    <span className="so-house" style={{ left, top }} aria-hidden>
      <span className="roof" />
      <span className="wall" style={{ background: tint }} />
      <span className="lit" />
    </span>
  );
}

/** The buildings behind the stop, each country's own from the kit. */
function Behind({ landing }: { landing: Landing }) {
  switch (landing.country) {
    case "country.uk":
      return (
        <>
          <Pic model="bld_rye-lane-terrace_b" style={{ left: -40, top: 70, width: 240 }} />
          <Pic model="bld_rye-lane-terrace_a" style={{ left: 170, top: 100, width: 260 }} />
          <div className="so-lamp" />
        </>
      );
    case "country.uae":
      return (
        <>
          <div className="so-skyline" />
          <Pic model="bld_deira-arcade_a" style={{ left: -30, top: 120, width: 220 }} />
          <Pic model="bld_deira-arcade_b" style={{ left: 180, top: 130, width: 230 }} />
          <div className="so-shimmer" />
        </>
      );
    case "country.canada":
      return (
        <>
          <House left={-10} top={250} tint="#c9b48f" />
          <House left={100} top={262} tint="#9fb4c9" />
          <House left={210} top={250} tint="#c99f8f" />
          <House left={318} top={262} tint="#b3c49f" />
          <div className="so-lamp" />
        </>
      );
    default:
      return (
        <>
          <div className="so-sea" />
          <Pic model="bld_shop-row" style={{ left: -20, top: 160, width: 250 }} />
          <Pic model="prop_street-bench" style={{ left: 270, top: 520, width: 90, zIndex: 2 }} />
        </>
      );
  }
}

/**
 * The landing (beat 5), laid out on the hall's lane (R-CHAPTER-012 (k); the catalog's pictures 158, 161 and 165): the
 * character, the bag at her feet and the person at the stop stand clear of the lane at the foot, so the button stands
 * under them and never over her feet or her bag. A person's picture is twice as tall as it is wide; the bag's is square.
 */
export const LANDING = {
  you: { left: 130, top: 424, width: 120 },
  stop: { left: 262, top: 444, width: 100 },
  bag: { left: 86, top: 568, width: 92 },
  /** The stop's line hangs from here, above the character's head, so a longer line grows upward. */
  bubbleBottom: 844 - 412,
} as const;

/** Beat 5: out into the place. The weather, the bag on the ground, the first line at the stop, the staple pulling in. */
export function LandingBeat({ dress, landing, place, weather, marker, heard, go, blind, onGo }: { dress: Dress; landing: Landing; place: string; weather: string; marker: string; heard: { name: string; words: string; look: string }; go: string; blind: string; onGo: () => void }) {
  const road = landing.staple === "pickup";
  return (
    <div className="so-beat so-in" data-so-beat="landing" data-so-country={landing.country} data-so-hub={landing.hub}>
      {road ? <div className="so-flat-road" /> : <div className="so-street" />}
      <Behind landing={landing} />
      <StapleAtStop landing={landing} blind={blind} />
      <div className="so-kerb" />
      <div className="so-pavement" />
      {landing.air === "rain" ? (
        <>
          <span className="so-puddle" style={{ left: 40, top: 612, width: 120, height: 26 }} />
          <span className="so-puddle" style={{ left: 250, top: 630, width: 90, height: 20 }} />
        </>
      ) : null}
      {landing.country === "country.uk" ? <Pic model="prop_bus-shelter" style={{ left: 238, top: 440, width: 170, zIndex: 2 }} /> : null}
      <span data-so-stop-person={heard.look}>
        <Person look={heard.look} style={{ ...LANDING.stop, transform: "scaleX(-1)", zIndex: 3 }} />
      </span>
      <You dress={dress} style={{ ...LANDING.you, zIndex: 3 }} />
      <Pic model="prop_travel-bag" style={{ ...LANDING.bag, zIndex: 3 }} />
      {landing.air === "rain" || landing.air === "snow" ? <span className="so-breath" style={{ left: 218, top: LANDING.you.top + 42 }} aria-hidden data-so-breath /> : null}
      {landing.air === "rain" ? <div className="so-rain" /> : null}
      {landing.air === "snow" ? <Snow /> : null}
      {/* Hung from its foot so a longer line grows upward, never down over the character's face. */}
      <Bubble name={heard.name} words={heard.words} right style={{ right: 14, bottom: LANDING.bubbleBottom, maxWidth: 210 }} mark="stop" />
      <p className="so-chip study" style={{ left: 16, top: 96 }} data-so-weather>
        <span className="spot" aria-hidden />
        {weather}
      </p>
      <p className="so-marker" style={{ top: 140 }} data-so-marker>
        {marker}
      </p>
      <div className="so-lane" style={{ top: LANE_TOP }} />
      <Band dress={dress} place={place} />
      <Go onClick={onGo} mark="ride">
        {go}
      </Go>
      <Thumbs dot />
    </div>
  );
}

/** What comes at the window on the first ride, each country's own road. */
function AtTheWindow({ landing }: { landing: Landing }) {
  switch (landing.country) {
    case "country.uk":
      return (
        <>
          <Pic model="bld_rye-lane-terrace_a" style={{ left: -60, top: 70, width: 200 }} />
          <Pic model="bld_rye-lane-terrace_b" style={{ right: -50, top: 60, width: 190, transform: "scaleX(-1)" }} />
          <Pic model="bld_rye-lane-terrace_b" style={{ left: 92, top: 118, width: 90 }} />
          <Pic model="bld_rye-lane-terrace_a" style={{ right: 96, top: 124, width: 84, transform: "scaleX(-1)" }} />
          <div className="pave" />
          <div className="road" />
          <Pic model="prop_market-stall" style={{ left: 6, top: 176, width: 84 }} />
          <Pic model="veh_taxi" style={{ right: 26, top: 236, width: 92, filter: "grayscale(1) brightness(0.35) drop-shadow(0 0 1.5px #fff)" }} />
        </>
      );
    case "country.uae":
      return (
        <>
          <Pic model="bld_deira-arcade_c" style={{ left: -50, top: 70, width: 200 }} />
          <Pic model="bld_deira-arcade_a" style={{ right: -40, top: 66, width: 190, transform: "scaleX(-1)" }} />
          <div className="pave" />
          <div className="road" />
          <Pic model="veh_taxi-dubai" style={{ right: 30, top: 236, width: 100 }} />
        </>
      );
    case "country.canada":
      return (
        <>
          <House left={0} top={130} tint="#c9b48f" />
          <House left={260} top={130} tint="#9fb4c9" />
          <div className="pave" />
          <div className="road" />
          <Snow count={24} />
        </>
      );
    default:
      return (
        <>
          <div className="so-sea" style={{ top: 64, height: 76 }} />
          <Pic model="bld_shop-row" style={{ left: -34, top: 70, width: 210 }} />
          <Pic model="prop_street-bench" style={{ right: 30, top: 150, width: 70 }} />
          <div className="pave" />
          <div className="road" />
        </>
      );
  }
}

/**
 * The first ride (beat 6), laid out so the character stands clear of the pings (R-CHAPTER-012 (k)): the pings in a stack
 * on the left above the lane, the character on the right with "So this is it." over her head, and "Send-off card saved"
 * in the scene's toast lane under the band, on nobody.
 */
export const RIDE = {
  toastTop: 90,
  window: { top: 132, height: 288 },
  /** The pings' stack: each ping whole (no line cut short), the stack ending above the lane. */
  pings: { left: 12, top: 428, width: 216, gap: 8 },
  you: { left: 238, top: 398, width: 128 },
  said: { right: 16, bottom: 844 - 392, width: 170 },
} as const;

/** What the inside of each staple carries, in front of the window: the top deck's pole, the cab's wheel, the taxi's front seats, the bus's rail and handles. */
function Inside({ landing }: { landing: Landing }) {
  switch (landing.staple) {
    case "double-decker":
      return (
        <>
          <div className="so-pole" />
          <div className="so-seatback" style={{ left: 18, top: 470 }}>
            <span className="back" />
            <span className="pattern" />
            <span className="cush" />
          </div>
        </>
      );
    case "pickup":
      return (
        <>
          <span className="so-mirror" aria-hidden />
          <span className="so-wheel" aria-hidden />
          <span className="so-bench" aria-hidden />
        </>
      );
    case "taxi":
      return (
        <>
          <span className="so-headrest" style={{ left: 44 }} aria-hidden />
          <span className="so-headrest" style={{ left: 232 }} aria-hidden />
          <span className="so-driver" aria-hidden />
          <span className="so-backseat" aria-hidden />
        </>
      );
    case "domitiana-bus":
      return (
        <>
          <span className="so-rail" aria-hidden>
            {[40, 120, 200, 280].map((left) => (
              <span key={left} className="loop" style={{ left }} />
            ))}
          </span>
          <div className="so-pole" />
          <div className="so-seatback" style={{ left: 18, top: 470 }}>
            <span className="back" />
            <span className="pattern" />
            <span className="cush" />
          </div>
        </>
      );
    default: {
      const never: never = landing.staple;
      throw new Error(`Unknown staple ${String(never)}`);
    }
  }
}

/** Beat 6: the first ride. The place at the window, "So this is it.", the pings, the card saved, the Phone's badge. */
export function Ride({ dress, landing, place, marker, pings, saved, onRing }: { dress: Dress; landing: Landing; place: string; marker: string; pings: { from: string; words: string }[]; saved: string; onRing: () => void }) {
  return (
    <div className="so-beat so-ride so-in" data-so-beat="ride" data-country={landing.country} data-staple={landing.staple}>
      <div className="so-ceiling" />
      <div className="so-window" style={{ top: RIDE.window.top, height: RIDE.window.height }}>
        <div className="so-abs so-coming" style={{ inset: 0 }}>
          <AtTheWindow landing={landing} />
        </div>
        {landing.air === "rain" ? <div className="so-drops" /> : null}
        {landing.staple === "domitiana-bus" ? <span className="so-pillar" aria-hidden /> : null}
      </div>
      <div className="so-frame" />
      <div className="so-dash" />
      <div className="so-ride-floor" />
      <Inside landing={landing} />
      <You dress={dress} style={{ ...RIDE.you, zIndex: 3 }} />
      {/* In a car the bag rides on the seat beside her, its top over the seat's edge; on a bus it stands at her feet. */}
      <Pic model="prop_travel-bag" style={{ left: 312, top: landing.staple === "pickup" || landing.staple === "taxi" ? 540 : 590, width: 70, zIndex: 3 }} />
      {landing.staple === "pickup" || landing.staple === "taxi" ? <span className={landing.staple === "pickup" ? "so-bench near" : "so-backseat near"} aria-hidden /> : null}
      <p className="so-marker" style={{ top: RIDE.window.top + 10 }} data-so-marker>
        {marker}
      </p>
      <Bubble name={dress.name} words={sendOffWords("sendoff.ride.said")} style={RIDE.said} tail={RIDE.you.left + RIDE.you.width / 2 - (390 - RIDE.said.right - RIDE.said.width) - 8} mark="you" />
      <p className="so-toast" style={{ top: RIDE.toastTop }} data-so-saved>
        <span className="tick" aria-hidden>
          {"✓"}
        </span>
        {saved}
      </p>
      <ol className="so-pings" aria-live="polite" style={{ left: RIDE.pings.left, top: RIDE.pings.top, width: RIDE.pings.width, gap: RIDE.pings.gap }} data-so-pings>
        {pings.map((ping, index) => (
          <li key={index} className="so-ping so-ping-in" style={{ animationDelay: `${String(0.25 + index * 0.35)}s` }} data-so-ping={index}>
            <b>{ping.from}</b>
            <span className="words">{ping.words}</span>
          </li>
        ))}
      </ol>
      <div className="so-lane ride" style={{ top: LANE_TOP }} />
      <Band dress={dress} place={place} />
      <Go onClick={onRing} mark="ring">
        {sendOffWords("sendoff.ring")}
      </Go>
      <Thumbs badge={pings.length} />
    </div>
  );
}
