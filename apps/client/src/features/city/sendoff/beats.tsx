// The six beats as pictures (docs/rules/chapter.md R-CHAPTER-012): each one screen, drawn as the maintainer's page with the
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
        <span>
          {dress.age} · {place}
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

/** A line said in a bubble with the speaker's name on it. */
function Bubble({ name, words, right = false, className = "", style, mark }: { name: string; words: string; right?: boolean; className?: string; style?: CSSProperties; mark?: string }) {
  return (
    <p className={`so-bubble so-pop ${right ? "right" : ""} ${className}`} style={style} data-so-said={mark}>
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

/** Where each speaker's bubble stands in the hall, over their head. */
const HALL_BUBBLE: Readonly<Record<Said["who"], CSSProperties>> = {
  mum: { left: 24, top: 470, maxWidth: 200 },
  cousin: { left: 150, top: 486, maxWidth: 220 },
  dad: { left: 120, top: 470, maxWidth: 220 },
  you: { left: 150, top: 300, maxWidth: 220 },
};

/** Beat 1: Departures. The queue moves one place a tap; one of the family speaks a line a tap; the character's line last. */
export function Departures({ dress, step, said, onStep, onLeave, waiting }: { dress: Dress; step: number; said: Said; onStep: () => void; onLeave: () => void; waiting: boolean }) {
  const ahead = Math.max(0, 2 - step);
  const marker = step >= 3 ? sendOffWords("sendoff.queue.front") : ahead === 0 ? sendOffWords("sendoff.queue.next") : sendOffWords("sendoff.queue.ahead", { count: ahead });
  // The queue steps up by moving everyone ahead out to the counter's side and the character up a place.
  const rise = Math.min(step, 3) * 22;
  return (
    <div className="so-beat so-in" data-so-beat="departures" data-so-step={step}>
      <div className="so-hall-wall">
        <span className="win" style={{ left: 14, width: 90 }} />
        <span className="win" style={{ left: 118, width: 90 }} />
        <span className="win" style={{ left: 222, width: 90 }} />
        <span className="win" style={{ left: 326, width: 60 }} />
      </div>
      <Pic model="prop_flight-board" style={{ right: 8, top: 150, width: 150 }} />
      <div className="so-counters">
        {[3, 4, 5].map((n, index) => (
          <span key={n} className="sign" style={{ left: 36 + index * 125 }}>
            {sendOffWords("sendoff.counter.desk", { n })}
          </span>
        ))}
      </div>
      <div className="so-floor" />
      <Person look={dress.cast.ahead[0]} className="so-queue" style={{ left: 120, top: 236, width: 60, zIndex: 0, opacity: step >= 1 ? 0 : 1, transform: step >= 1 ? "translateX(-40px)" : "none" }} />
      <Person look={dress.cast.ahead[1]} className="so-queue" style={{ left: 232, top: 230, width: 64, zIndex: 0, opacity: step >= 2 ? 0 : 1, transform: step >= 2 ? "translateX(40px) scaleX(-1)" : "scaleX(-1)" }} />
      <You dress={dress} className="so-queue" style={{ left: 118, top: 372, width: 118, zIndex: 2, transform: `translateY(-${String(rise)}px)` }} />
      <Pic model="prop_travel-bag" className="so-queue" style={{ left: 232, top: 520, width: 90, zIndex: 2, transform: `translateY(-${String(rise)}px)` }} />
      <p className="so-marker" style={{ top: 92 }} data-so-marker>
        {marker}
      </p>
      <span className="so-post" style={{ left: 26 }} />
      <span className="so-post" style={{ left: 352 }} />
      <span className="so-rope" />
      <Person look={dress.cast.mum} style={{ left: 34, top: 596, width: 96, zIndex: 3 }} />
      <Person look={dress.cast.dad} style={{ left: 150, top: 590, width: 100, zIndex: 3 }} />
      <Person look={dress.cast.cousin} style={{ left: 262, top: 606, width: 90, transform: "scaleX(-1)", zIndex: 3 }} />
      <Bubble key={`${String(step)}-${said.who}`} name={said.name} words={said.words} style={HALL_BUBBLE[said.who]} mark={said.who} />
      {said.who === "mum" ? (
        <span className="so-emote" style={{ left: 298, top: 572 }} aria-hidden>
          ...
        </span>
      ) : null}
      <Band dress={dress} place={sendOffWords("sendoff.band.departures")} />
      <Go onClick={onStep} disabled={waiting} mark="step">
        {sendOffWords("sendoff.step")}
      </Go>
      <Leave onLeave={onLeave} />
      <Thumbs />
    </div>
  );
}

/** Beat 2: the counter. The passport and the stub slide across; Window or aisle changes the stub's seat letter only. */
export function Counter({ dress, flight, to, seat, seatWords, onSeat, onTake, onLeave }: { dress: Dress; flight: string; to: string; seat: Seat; seatWords: string; onSeat: (seat: Seat) => void; onTake: () => void; onLeave: () => void }) {
  return (
    <div className="so-beat so-in" data-so-beat="counter">
      <div className="so-desk-wall" />
      <p className="so-desk-sign">{sendOffWords("sendoff.counter.desk", { n: 4 })}</p>
      <div className="so-clerk">
        <Person look={dress.cast.clerk} style={{ left: 0, top: 0, width: 120, position: "relative" }} />
      </div>
      <div className="so-desk" />
      <div className="so-desk-floor" />
      <You dress={dress} style={{ left: 20, top: 300, width: 150, zIndex: 2 }} />
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
      <div className="so-seat" style={{ right: 26, top: 246 }} role="group" aria-label={sendOffWords("sendoff.counter.ask")} data-so-seats>
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
      <Band dress={dress} place={sendOffWords("sendoff.band.departures")} />
      <Go onClick={onTake} mark="take">
        {sendOffWords("sendoff.take")}
      </Go>
      <Leave onLeave={onLeave} />
      <Thumbs />
    </div>
  );
}

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
      <div className="so-door" />
      <p className="so-gate-sign">{sendOffWords("sendoff.gate.sign", { city: city.toUpperCase() })}</p>
      <div className="so-gate-floor" />
      <You dress={dress} style={{ left: 150, top: 320, width: 100, zIndex: 2 }} />
      <Pic model="prop_travel-bag" style={{ left: 228, top: 440, width: 64, zIndex: 2 }} />
      <Person look={dress.cast.mum} pose="cheer" className="so-wave" style={{ left: 22, top: 560, width: 104, zIndex: 3 }} />
      <Person look={dress.cast.dad} pose="cheer" className="so-wave" style={{ left: 146, top: 548, width: 110, zIndex: 3, animationDelay: "0.15s" }} />
      <Person look={dress.cast.cousin} pose="cheer" className="so-wave" style={{ left: 272, top: 566, width: 100, zIndex: 3, animationDelay: "0.3s" }} />
      <Bubble name={papa.name} words={papa.words} style={{ left: 118, top: 476, maxWidth: 200 }} mark="dad" />
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

/** Beat 5: out into the place. The weather, the bag on the ground, the first line at the stop, the staple pulling in. */
export function LandingBeat({ dress, landing, place, weather, marker, heard, go, blind, onGo }: { dress: Dress; landing: Landing; place: string; weather: string; marker: string; heard: { name: string; words: string }; go: string; blind: string; onGo: () => void }) {
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
          <span className="so-puddle" style={{ left: 40, top: 640, width: 120, height: 26 }} />
          <span className="so-puddle" style={{ left: 250, top: 700, width: 90, height: 20 }} />
        </>
      ) : null}
      {landing.country === "country.uk" ? <Pic model="prop_bus-shelter" style={{ left: 238, top: 440, width: 170, zIndex: 2 }} /> : null}
      <Person look={dress.cast.ahead[0]} style={{ left: 262, top: 484, width: 100, transform: "scaleX(-1)", zIndex: 3 }} />
      <You dress={dress} style={{ left: 130, top: 470, width: 120, zIndex: 3 }} />
      <Pic model="prop_travel-bag" style={{ left: 86, top: 626, width: 92, zIndex: 3 }} />
      {landing.air === "rain" || landing.air === "snow" ? <span className="so-breath" style={{ left: 218, top: 512 }} aria-hidden data-so-breath /> : null}
      {landing.air === "rain" ? <div className="so-rain" /> : null}
      {landing.air === "snow" ? <Snow /> : null}
      {/* Hung from its foot so a longer line grows upward, never down over the character's face. */}
      <Bubble name={heard.name} words={heard.words} right style={{ right: 14, bottom: 384, maxWidth: 210 }} mark="stop" />
      <p className="so-chip study" style={{ left: 16, top: 96 }} data-so-weather>
        <span className="spot" aria-hidden />
        {weather}
      </p>
      <p className="so-marker" style={{ top: 140 }} data-so-marker>
        {marker}
      </p>
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
          <Pic model="bld_shop-row" style={{ left: -40, top: 90, width: 220 }} />
          <div className="so-sea" style={{ top: 120, height: 80 }} />
          <div className="pave" />
          <div className="road" />
        </>
      );
  }
}

/** Beat 6: the first ride. The place at the window, "So this is it.", the pings, the card saved, the Phone's badge. */
export function Ride({ dress, landing, place, marker, pings, saved, onRing }: { dress: Dress; landing: Landing; place: string; marker: string; pings: { from: string; words: string }[]; saved: string; onRing: () => void }) {
  return (
    <div className="so-beat so-ride so-in" data-so-beat="ride" data-country={landing.country}>
      <div className="so-ceiling" />
      <div className="so-window">
        <div className="so-abs so-coming" style={{ inset: 0 }}>
          <AtTheWindow landing={landing} />
        </div>
        {landing.air === "rain" ? <div className="so-drops" /> : null}
      </div>
      <div className="so-frame" />
      <div className="so-dash" />
      <div className="so-ride-floor" />
      <div className="so-pole" />
      <div className="so-seatback">
        <span className="back" />
        <span className="pattern" />
        <span className="cush" />
      </div>
      <You dress={dress} style={{ left: 92, top: 400, width: 138, zIndex: 3 }} />
      <Pic model="prop_travel-bag" style={{ left: 196, top: 600, width: 84, zIndex: 3 }} />
      <p className="so-marker" style={{ top: 106 }} data-so-marker>
        {marker}
      </p>
      <Bubble name={dress.name} words={sendOffWords("sendoff.ride.said")} style={{ left: 150, top: 300, maxWidth: 180 }} mark="you" />
      <p className="so-chip money" style={{ right: 14, top: 432 }} data-so-saved>
        <span className="tick" aria-hidden>
          {"✓"}
        </span>
        {saved}
      </p>
      <ol aria-live="polite">
        {pings.map((ping, index) => (
          <li key={index} className="so-ping so-ping-in" style={{ top: 482 + index * 62, animationDelay: `${String(0.25 + index * 0.35)}s` }} data-so-ping={index}>
            <b>{ping.from}</b>
            <span className="words">{ping.words}</span>
          </li>
        ))}
      </ol>
      <Band dress={dress} place={place} />
      <Go onClick={onRing} mark="ring">
        {sendOffWords("sendoff.ring")}
      </Go>
      <Thumbs badge={pings.length} />
    </div>
  );
}
