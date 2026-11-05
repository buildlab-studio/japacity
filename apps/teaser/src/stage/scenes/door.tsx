// Who you are: the front door's second screen, Your life so far. The lives stand as cards in a deck; the developer's
// is tapped and picked, the ways it opens settle in under the deck, and Next takes the life on to where you live.
import { ChevronLeft, Minus, Plus, Shuffle } from "lucide-react";

import { Bar, Stage, type Act } from "../kit";
import { Column, DOOR_COLUMN, FRAME, Host, SCREEN, type Shape } from "../host";
import { DrawnPic, MainButton, Sticker, StickerChip } from "../parts";
import { now, tapAt, until } from "../timeline";
import { DOOR_BEAT } from "../timings";
import { W } from "../words";

type S = { picked: boolean };

/** A life's card, 282 wide as the game draws it: its thing big on the tint of its kind, the tag, the face sticker and its words. */
function LifeCard({ on, left }: { on: boolean; left: number }) {
  return (
    <span className="door-life door-card" role="radio" aria-checked={on} data-target="life" style={{ left, rotate: on ? "-1.5deg" : "1.5deg" }}>
      <span className="tint-study" style={{ position: "relative", display: "block", height: 150, borderRadius: 14 }}>
        <StickerChip className="tint-soft" tilt={-4} style={{ position: "absolute", top: 12, left: 12, zIndex: 3, fontSize: 14, padding: "4px 12px" }}>
          {W.tag}
        </StickerChip>
        <Sticker tile="prop_laptop-desk" size={150} tilt={5} style={{ position: "absolute", top: 8, right: 8 }} />
        <span className="face-sticker tint-food" style={{ position: "absolute", bottom: -22, left: -10, zIndex: 3, width: 80, height: 80, rotate: "-6deg" }}>
          <img src="../tiles/person_tobi-face.webp" alt="" draggable={false} />
        </span>
      </span>
      <span style={{ display: "block", padding: "30px 6px 4px" }}>
        <span style={{ display: "block", fontSize: 22, lineHeight: 1.15, fontWeight: 700 }}>{W.developer}</span>
        <span style={{ display: "block", marginTop: 2, fontSize: 16, fontWeight: 500, color: "var(--text-2)" }}>{W.life}</span>
        <span style={{ display: "block", marginTop: 6, fontSize: 13, lineHeight: 1.35, color: "var(--text-2)" }}>{W.was}</span>
        <span style={{ display: "block", marginTop: 10 }}>
          <StickerChip className="tint-money jc-num" tilt={-2} style={{ fontSize: 14, padding: "4px 12px", color: "var(--money-ink)" }}>
            {W.savings}
          </StickerChip>
        </span>
      </span>
    </span>
  );
}

/** The next life in the deck, past the column's edge: its picture and its shape, the words left to the card in front. */
function NextCard({ left }: { left: number }) {
  return (
    <span className="door-life door-card" aria-hidden style={{ left, rotate: "1.5deg", opacity: 0.86, transform: "scale(0.95)" }}>
      <span className="tint-body" style={{ position: "relative", display: "block", height: 150, borderRadius: 14 }}>
        <Sticker tile="prop_xray-stand" size={150} tilt={5} style={{ position: "absolute", top: 8, right: 8 }} />
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 10, padding: "30px 6px 4px" }}>
        <Bar w={150} h={14} r={7} tone={3} />
        <Bar w={110} h={10} r={5} tone={2} />
        <Bar w={190} h={8} r={4} tone={2} />
      </span>
    </span>
  );
}

function Door({ shape, s }: { shape: Shape; s: S }) {
  const screen = SCREEN[shape];
  const tall = shape === "tall";
  const column = DOOR_COLUMN[shape];
  const cardLeft = (column - 282) / 2;
  const deckTop = screen.top + (tall ? 132 : 120);
  const cardBottom = deckTop + 318;
  return (
    <div className="door">
      <Column shape={shape} width={column}>
        <div style={{ position: "absolute", left: 16, right: 16, top: screen.top + 4, display: "flex", alignItems: "center", gap: 8 }}>
          <span className="round-button" aria-hidden>
            <ChevronLeft size={22} strokeWidth={2.4} />
          </span>
          <span style={{ flex: 1 }} />
          <span className="round-button" aria-hidden>
            <Shuffle size={18} strokeWidth={2.4} />
          </span>
          <span className="pill-button">{W.skip}</span>
        </div>
        <div style={{ position: "absolute", left: 20, right: 20, top: screen.top + 60 }}>
          <div className="jc-title" style={{ fontSize: 24 }}>{W.doorTitle}</div>
          <div style={{ marginTop: 4, fontSize: 14, color: "var(--text-2)" }}>{W.doorLine}</div>
        </div>
        <div data-crop style={{ position: "absolute", left: 0, right: 0, top: deckTop - 12, height: 372, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 12 }}>
            <LifeCard on={s.picked} left={cardLeft} />
            <NextCard left={cardLeft + 282 + 14} />
          </div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: cardBottom + 12, display: "flex", justifyContent: "center", gap: 8 }}>
          <StickerChip className="arrive" tilt={-2.5} style={{ fontSize: 14, padding: "6px 12px" }} {...(s.picked ? {} : { "data-out": "" })}>
            <Sticker tile="building_rye-lane-terrace_a" size={20} /> {W.wayTech}
          </StickerChip>
          <StickerChip className="arrive" tilt={2} style={{ fontSize: 14, padding: "6px 12px", transitionDelay: s.picked ? "60ms" : "0ms" }} {...(s.picked ? {} : { "data-out": "" })}>
            <DrawnPic pic="🎓" size={20} /> {W.wayMasters}
          </StickerChip>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: cardBottom + 60, display: "flex", justifyContent: "center" }} aria-hidden>
          <span className="door-dots">
            {[0, 1, 2, 3, 4, 5, 6].map((at) => (
              <i key={at} {...(at === 0 && s.picked ? { "data-now": "" } : {})} />
            ))}
          </span>
        </div>
        {tall ? (
          <section className="door-card" style={{ position: "absolute", left: 20, right: 20, top: cardBottom + 92, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
            <span className="sticker-cut" style={{ rotate: "-6deg" }}>
              <span className="tint-soft" style={{ display: "flex", width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12 }}>
                <DrawnPic pic="🎂" size={26} />
              </span>
            </span>
            <span style={{ flex: 1, minWidth: 0, lineHeight: 1.2 }}>
              <span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>{W.age}</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--text-2)" }}>{W.ageFrom}</span>
            </span>
            <span className="round-button" aria-hidden>
              <Minus size={20} strokeWidth={2.4} />
            </span>
            <span className="jc-num" style={{ minWidth: 52, textAlign: "center", fontSize: 34, lineHeight: 1 }}>
              23
            </span>
            <span className="round-button" aria-hidden>
              <Plus size={20} strokeWidth={2.4} />
            </span>
          </section>
        ) : null}
        <div style={{ position: "absolute", left: 16, right: 16, bottom: tall ? 40 : 18 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }} aria-hidden>
            <span className="door-dots">
              <i data-done="" />
              <i data-now="" />
              <i />
            </span>
          </div>
          <MainButton act={W.next} then={W.nextThen} target="next" />
        </div>
      </Column>
    </div>
  );
}

function script(shape: Shape) {
  return async (a: Act<S>) => {
    a.mark("start");
    const start = now();
    await tapAt(a, shape, start, "life", DOOR_BEAT.pick);
    a.put({ picked: true });
    a.mark("picked");
    // The hand leaves the card for the empty sky beside it while the ways settle in, then goes on to Next.
    if (shape === "wide") void a.move({ x: 1010, y: 470 }, { duration: 500 });
    await tapAt(a, shape, start, "next", DOOR_BEAT.next);
    a.mark("next");
    await until(a, start, DOOR_BEAT.end);
  };
}

const SCRIPTS = { wide: script("wide"), tall: script("tall") };

export function DoorScene({ shape }: { shape: Shape }) {
  const size = FRAME[shape];
  return (
    <Stage<S>
      width={size.width}
      height={size.height}
      initial={{ picked: false }}
      poster={{ picked: true }}
      script={SCRIPTS[shape]}
      play="once"
      fill
      className="jc"
      cursor={shape === "tall" ? { at: { x: 270, y: 760 }, style: "touch" } : { at: { x: 1000, y: 560 }, style: "real" }}
    >
      {(s) => (
        <Host shape={shape}>
          <Door shape={shape} s={s} />
        </Host>
      )}
    </Stage>
  );
}
