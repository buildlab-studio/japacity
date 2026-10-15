// The third light (docs/rules/account.md R-ACCOUNT-032): on the start screen's wire of the two lights a third, small light hangs past
// abroad, warm, and never goes out, not even at night. It says nothing until tapped, and the tap opens the dedication
// page. A light of the player's own (R-ACCOUNT-033), when one is kept on this device, hangs beside it, smaller, its name
// shown on tap.
//
// It sits over the two lights' picture as a layer of its own, so the picture stays a picture of everyone that nothing in
// it can be tapped (R-ACCOUNT-031). Drawn as the two lights are: one still SVG for the wire and the bulbs, and a glow
// layer each that breathes by opacity alone; reduced motion holds them still (world.md R-WORLD-023).
import { useState } from "react";

import { lightWords, useOwnLight } from "../../shared/frontdoor/ownLight";
import { say } from "../../shared/words/text";
import { Bulb, capTop, Glow } from "./bulb";
import { Dedication } from "./Dedication";
import { ABROAD, H, W } from "./TwoLights";

/** The third light, past abroad on the wire, and its size: small. */
export const THIRD = { x: 346, y: 162, r: 7 };
/** A player's own light, smaller, hanging where the wire dips between abroad and the third. */
export const OWN_ON_WIRE = { x: 312, y: 166, r: 5 };

/** From the far side of abroad's glass, dipping to the third light's cap, and on off the edge of the screen. */
const WIRE = `M${String(ABROAD.x + 8)} ${String(ABROAD.y - 4)} Q312 172 ${String(THIRD.x)} ${String(capTop(THIRD.y, THIRD.r))} Q374 130 440 92`;

/** The room under the picture where a light's name shows on tap, over the scene. */
const NAME_ROOM = 56;

export function ThirdLight() {
  const own = useOwnLight();
  const [open, setOpen] = useState(false);
  const [named, setNamed] = useState(false);
  const words = own === null ? null : lightWords(own, say("ui.dedication.between"));
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden" style={{ height: H + NAME_ROOM }} data-third-light>
        <div className="absolute top-0 left-1/2 -translate-x-1/2" style={{ width: W, height: H }}>
          <Glow x={THIRD.x} y={THIRD.y} radius={30} alpha={0.95} name="third" />
          {own === null ? null : <Glow x={OWN_ON_WIRE.x} y={OWN_ON_WIRE.y} radius={20} alpha={0.85} offsetMs={2_000} name="own" />}
          <svg className="absolute inset-0 overflow-visible" width={W} height={H} viewBox={`0 0 ${String(W)} ${String(H)}`} aria-hidden>
            <path d={WIRE} fill="none" stroke="#c9c2b2" strokeOpacity="0.7" strokeWidth="1.4" />
            <Bulb x={THIRD.x} y={THIRD.y} r={THIRD.r} />
            {own === null ? null : <Bulb x={OWN_ON_WIRE.x} y={OWN_ON_WIRE.y} r={OWN_ON_WIRE.r} />}
          </svg>
          {/* It says nothing until tapped: no words on screen, only a name for a screen reader. */}
          <button
            type="button"
            className="pointer-events-auto absolute h-11 w-9 touch-manipulation rounded-md focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
            style={{ left: THIRD.x - 18, top: THIRD.y - 26 }}
            aria-label={say("ui.dedication.light")}
            onClick={() => setOpen(true)}
            data-third-light-tap
          />
          {words === null ? null : (
            <button
              type="button"
              className="pointer-events-auto absolute h-11 w-8 touch-manipulation rounded-md focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
              style={{ left: OWN_ON_WIRE.x - 16, top: OWN_ON_WIRE.y - 24 }}
              aria-label={words}
              aria-expanded={named}
              onClick={() => setNamed((was) => !was)}
              data-own-light="wire"
            />
          )}
        </div>
        {named && words !== null ? (
          <p
            className="motion-in-fade absolute right-3 max-w-[260px] rounded-[6px] px-2 py-1 text-right text-[13px] leading-snug font-semibold text-white"
            style={{ top: H + 4, background: "rgba(11, 16, 36, 0.72)" }}
            data-own-light-name
          >
            {words}
          </p>
        ) : null}
      </div>
      <Dedication open={open} onClose={() => setOpen(false)} />
    </>
  );
}
