// The send-off as a scene (docs/rules/chapter.md R-CHAPTER-012): six beats, seen once per life, from the airport's gate
// to the first ride abroad, in place of the card the flight used to be. Its own chunk, fetched when the gate's act is
// picked, never on a first visit (engine.md R-ENGINE-020). Beats 1 and 2 change nothing in the life; "Board the plane"
// at beat 3 sends `route/depart` once, exactly as the card did; beats 4 to 6 run on the client over the view after the
// reply, and the simulation knows nothing of them. The scene counts nothing of its own (R-ANALYTICS-002).
import "./sendoff.css";

import { content, text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import type { ReactNode } from "react";

import type { PlayerCommand } from "../../../authority/store";
import { useEffect, useRef } from "react";

import { cue } from "../../../shared/sound/cues";
import { type PlaneCutSlot, sendOff, useSeat, useSendOff } from "../../../shared/world/sendOff";
import { formatMoney } from "../../../shared/words/format";
import { nameOf, say, words } from "../../../shared/words/text";
import { sendOffWords } from "../sendOff.words";
import { Counter, Departures, type Dress, Gate, LandingBeat, Plane, Ride, useStageScale } from "./beats";
import { blindName, castFor, firstPings, flightCost, FRONT_MS, GATE_LINE, landingOf, PLANE_MS, queueLine, speakerName, stopLookFor } from "./plan";

/** The city the plane's sticker names, by the hub's city in content (world.md R-WORLD-037). */
export function planeCity(city: string): string {
  return sendOffWords(`sendoff.plane.city.${city}`);
}

/** Who the character is, read by the city where the person kept beside the save is read (the scene's chunk stays small). */
export interface SendOffYou {
  /** The name the world's band shows. */
  name: string;
  /** The first name the stub carries. */
  first: string;
  /** The look the character wears. */
  look: string;
  /** The whole figure in the character's own colours. */
  figure: ReactNode;
}

/**
 * The game as the city holds it, handed in: the scene's chunk imports nothing of the store, so the first visit's chunks
 * keep their shape (engine.md R-ENGINE-020).
 */
export interface SendOffGame {
  view: PlayerView;
  busy: boolean;
  /** Sends a command; resolves with whether it was accepted. */
  send: (command: PlayerCommand) => Promise<boolean>;
  /** The last rejection's words where the player acted. */
  rejection: ReactNode;
}

export interface SendOffSceneProps {
  you: SendOffYou;
  game: SendOffGame;
  /** The map's plane cut, handed in by the shell (world.md R-WORLD-037); without it beat 4 is the night colour alone. */
  planeCut?: (slot: PlaneCutSlot) => ReactNode;
}

/** The seat's words, as the stub carries them (share.md R-SHARE-015). */
function seatWords(seat: string): string {
  return text[`share.stub.seat.${seat}`] ?? seat;
}

export default function SendOffScene({ you, game, planeCut }: SendOffSceneProps) {
  const scene = useSendOff();
  const { view, send, busy, rejection } = game;
  const seat = useSeat();
  const scale = useStageScale();
  const root = useRef<HTMLDivElement>(null);
  const beat = scene?.beat ?? null;
  const step = scene?.step ?? 0;
  // After the third tap the character's line stands a moment, then the counter comes (beat 1 to 2).
  useEffect(() => {
    if (beat !== "departures" || step < 3) return;
    const timer = window.setTimeout(() => sendOff.getState().to("counter"), FRONT_MS);
    return () => window.clearTimeout(timer);
  }, [beat, step]);
  // The plane's cut lasts about three seconds, moving or still, then the landing (R-WORLD-037).
  useEffect(() => {
    if (beat !== "plane") return;
    const timer = window.setTimeout(() => sendOff.getState().to("landing"), PLANE_MS);
    return () => window.clearTimeout(timer);
  }, [beat]);
  // The first ride says the card is saved (share.md R-SHARE-015): from here the card is kept where the phone keeps cards.
  useEffect(() => {
    if (beat === "ride") sendOff.getState().save();
  }, [beat]);
  // Each beat takes the focus, so a screen reader hears the new screen and Escape is heard.
  useEffect(() => {
    root.current?.focus();
  }, [beat]);
  if (scene === null) return null;
  const landing = landingOf(scene.country);
  const ageMonths = view.qualities.find((quality) => quality.id === "quality.age-months")?.value ?? 0;
  const age = say("ui.world.clock", { years: Math.floor(ageMonths / 12), months: ageMonths % 12 });
  // Before the plane the band counts the naira; after it, the landing country's own money (R-WORLD-002 abroad).
  const abroad = scene.beat === "plane" || scene.beat === "landing" || scene.beat === "ride";
  const currency = abroad ? (content.country[scene.country]?.currency ?? "NGN") : "NGN";
  const pocket = view.pockets[currency];
  const { name, first, look, figure } = you;
  const dress: Dress = { name, first, age, look, figure, cast: castFor(look), money: formatMoney(pocket.bank + pocket.cash, currency) };
  const city = landing === null ? "" : planeCity(landing.city);
  const leave = () => {
    cue("close");
    sendOff.getState().close();
  };
  const before = scene.beat === "departures" || scene.beat === "counter" || scene.beat === "gate";
  const screen = (() => {
    switch (scene.beat) {
      case "departures": {
        const line = queueLine(Math.min(scene.step, 3));
        return (
          <Departures
            dress={dress}
            step={scene.step}
            said={{ name: speakerName(line.who, view.scenario, name), words: words(line.key), who: line.who }}
            waiting={scene.step >= 3}
            onStep={() => {
              cue("tap");
              sendOff.getState().stepForward();
            }}
            onLeave={leave}
          />
        );
      }
      case "counter": {
        const cost = flightCost(scene.route);
        return (
          <Counter
            dress={dress}
            flight={cost === null ? sendOffWords("sendoff.flight.employer") : sendOffWords("sendoff.flight", { amount: formatMoney(cost.amount, cost.currency) })}
            to={city}
            seat={seat}
            seatWords={seatWords(seat)}
            onSeat={(chosen) => {
              cue("tap");
              sendOff.getState().choose(chosen);
            }}
            onTake={() => {
              cue("tap");
              sendOff.getState().to("gate");
            }}
            onLeave={leave}
          />
        );
      }
      case "gate": {
        // Held funds still open stop the flight, as on the card (route/depart).
        const held = view.obligations.some((owed) => content.obligation[owed.entry]?.type === "held-funds");
        return (
          <Gate
            dress={dress}
            city={city}
            papa={{ name: words(`${GATE_LINE}.by`), words: words(GATE_LINE) }}
            board={say("ui.route.depart")}
            blocked={held ? say("ui.world.depart-held") : null}
            busy={busy}
            rejection={
              <div className="so-abs" style={{ left: 16, right: 16, bottom: 186, zIndex: 8 }}>
                {rejection}
              </div>
            }
            onBoard={() => {
              // The one act of the scene that changes the life (R-CHAPTER-012 beat 3): sent once, the scene moving on only on its yes.
              void send({ type: "route/depart", route: scene.route }).then((accepted) => {
                if (accepted) {
                  cue("whoosh");
                  sendOff.getState().to("plane");
                } else cue("tap");
              });
            }}
            onLeave={leave}
          />
        );
      }
      case "plane":
        return <Plane cut={planeCut?.({ country: scene.country, city, small: sendOffWords("sendoff.plane.small"), line: sendOffWords("sendoff.plane.line"), ms: PLANE_MS }) ?? null} />;
      case "landing": {
        if (landing === null) return null;
        const blindKey = `sendoff.landing.blind.${landing.country}`;
        return (
          <LandingBeat
            dress={dress}
            landing={landing}
            place={sendOffWords(`sendoff.band.landing.${landing.country}`, { hub: nameOf(landing.hub) })}
            weather={sendOffWords(`sendoff.landing.weather.${landing.country}`)}
            marker={sendOffWords(`sendoff.landing.marker.${landing.country}`)}
            heard={{ name: sendOffWords(`sendoff.landing.by.${landing.country}`), words: words(landing.heard), look: stopLookFor(landing.country, look) }}
            go={sendOffWords(`sendoff.landing.go.${landing.country}`)}
            blind={sendOffWords(blindKey, { hub: blindName(landing.hub) })}
            onGo={() => {
              cue("tap");
              sendOff.getState().to("ride");
            }}
          />
        );
      }
      case "ride": {
        if (landing === null) return null;
        return (
          <Ride
            dress={dress}
            landing={landing}
            place={sendOffWords(`sendoff.band.ride.${landing.country}`)}
            marker={sendOffWords(`sendoff.ride.marker.${landing.country}`)}
            pings={firstPings(view.scenario, landing.staple).map((ping) => ({ from: ping.from, words: sendOffWords(ping.key) }))}
            saved={sendOffWords("sendoff.saved")}
            onRing={() => {
              cue("done");
              sendOff.getState().close();
            }}
          />
        );
      }
      default: {
        const never: never = scene.beat;
        throw new Error(`Unknown beat ${String(never)}`);
      }
    }
  })();
  return (
    <div
      ref={root}
      className="so"
      role="dialog"
      aria-modal="true"
      aria-label={say("ui.route.depart")}
      tabIndex={-1}
      data-send-off={scene.beat}
      data-country={scene.country}
      onKeyDown={(event) => {
        if (event.key === "Escape" && before) leave();
      }}
    >
      <div className="so-stage" style={{ transform: `translate(-50%, -50%) scale(${String(scale)})` }}>
        {screen}
      </div>
    </div>
  );
}
