// The month's results, leading with the money: the salary in, what was kept, and the savings bar filling toward the move.
// Under them, what was asked of you: a tech firm offering to sponsor. Its row opens the ask, one sign showing; Look
// closer finds the other.
import { ChevronRight } from "lucide-react";

import { Count, Stage, type Act } from "../kit";
import { Column, FRAME, Host, SCREEN, type Shape, World } from "../host";
import { Band, DrawnPic, Face, faceMark, LookCloser, MainButton, SheetClose, Sticker, StickerChip } from "../parts";
import { now, tapAt, until } from "../timeline";
import { MONTH_BEAT, SAVED } from "../timings";
import { W } from "../words";

type S = { saved: number; ask: boolean; looked: boolean };

const pounds = (value: number) => `£${Math.round(value).toLocaleString("en-GB")}`;

function Results({ s }: { s: S }) {
  const firm = faceMark(W.firm);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-2)" }}>{W.ageLater}</div>
        <div className="jc-title">{W.done}</div>
      </div>
      <div className="look-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: 12 }}>
        <span className="tint-money" style={{ display: "flex", width: 64, height: 64, flex: "none", alignItems: "center", justifyContent: "center", borderRadius: 14 }}>
          <Sticker tile="prop_long-desk" size={46} tilt={-5} />
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", fontSize: 15, lineHeight: 1.3, fontWeight: 700 }}>{W.salary}</span>
          <span className="jc-num" style={{ display: "block", fontSize: 22, color: "var(--in)" }}>
            +₦320,000
          </span>
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-2)" }}>{W.kept}</span>
        <span className="jc-num" style={{ fontSize: 24, lineHeight: 1, color: "var(--in)" }}>
          +₦262,000
        </span>
      </div>
      <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <span className="jc-label">{W.saved}</span>
          <span className="jc-num" style={{ fontSize: 14 }}>
            <Count value={s.saved} format={pounds} duration={900} /> of {pounds(SAVED.required)}
          </span>
        </div>
        <div className="save-bar">
          <span style={{ transform: `scaleX(${String(s.saved / SAVED.required)})` }} />
        </div>
      </section>
      <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-2)" }}>{W.asked}</div>
        <span data-target="row" className="look-card" style={{ display: "flex", minHeight: 48, alignItems: "center", gap: 12, padding: "6px 12px", boxShadow: "none" }}>
          <span className="face-mark" style={{ width: 40, height: 40, fontSize: 17, background: firm.colour }}>
            {firm.initial}
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontSize: 13, lineHeight: 1.3, fontWeight: 700, color: "var(--text-2)" }}>{W.firm}</span>
            <span style={{ display: "block", fontSize: 15, lineHeight: 1.3, fontWeight: 700 }}>{W.sponsor}</span>
          </span>
          <ChevronRight size={18} strokeWidth={2.4} style={{ flex: "none", color: "var(--text-2)" }} aria-hidden />
        </span>
      </section>
      <MainButton act={W.back} />
    </div>
  );
}

function Ask({ s }: { s: S }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-2)" }}>{W.where}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span className="ask-mark" style={{ background: "#6b7a90" }} aria-hidden>
          ?
          <span className="sticker-cut" style={{ position: "absolute", right: -8, bottom: -4, rotate: "8deg" }}>
            <DrawnPic pic="💸" size={26} />
          </span>
        </span>
        <span style={{ minWidth: 0 }}>
          <Face name={W.firm} />
          <span style={{ display: "block", marginTop: 4, fontSize: 22, lineHeight: 1.15, fontWeight: 700 }}>{W.sponsor}</span>
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.35 }}>{W.offer}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <StickerChip tilt={-2}>{W.answer}</StickerChip>
        <StickerChip className="tint-soft" tilt={2}>
          <span aria-hidden>👀</span>
          {W.signVideo}
        </StickerChip>
        <span style={{ position: "relative", display: "inline-flex" }}>
          <span className="arrive" style={{ display: "inline-flex" }} {...(s.looked ? { "data-out": "" } : {})}>
            <LookCloser target="look" />
          </span>
          <StickerChip className="tint-soft arrive" tilt={-1} style={{ position: "absolute", left: 0, top: 0 }} {...(s.looked ? {} : { "data-out": "" })}>
            <span aria-hidden>👀</span>
            {W.signChat}
          </StickerChip>
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 2 }}>
        <span className="ask-reply">{W.decline}</span>
        <span className="ask-reply">{W.take}</span>
      </div>
    </div>
  );
}

function Month({ shape, s }: { shape: Shape; s: S }) {
  const screen = SCREEN[shape];
  const tall = shape === "tall";
  return (
    <>
      <World shape={shape} />
      <Column shape={shape}>
        <div style={{ position: "absolute", left: 12, right: 12, top: screen.top }}>
          <Band age={W.ageLater} place={W.home} money="₦2,502,000" />
        </div>
        <div className="sheet">
          <span className="sheet-grab" />
          <SheetClose />
          <div style={{ display: "grid", padding: `6px 16px ${tall ? "38px" : "16px"}` }}>
            <div className="rise" style={{ gridArea: "1 / 1" }} {...(s.ask ? { "data-out": "" } : {})}>
              <Results s={s} />
            </div>
            <div className="rise" style={{ gridArea: "1 / 1" }} {...(s.ask ? {} : { "data-out": "" })}>
              <Ask s={s} />
            </div>
          </div>
        </div>
      </Column>
    </>
  );
}

function script(shape: Shape) {
  return async (a: Act<S>) => {
    a.mark("start");
    const start = now();
    await until(a, start, MONTH_BEAT.fill);
    a.put({ saved: SAVED.after });
    a.mark("saved");
    await tapAt(a, shape, start, "row", MONTH_BEAT.row);
    a.put({ ask: true });
    a.mark("ask");
    await tapAt(a, shape, start, "look", MONTH_BEAT.look);
    a.put({ looked: true });
    a.mark("looked");
    await until(a, start, MONTH_BEAT.end);
  };
}

const SCRIPTS = { wide: script("wide"), tall: script("tall") };

export function MonthScene({ shape }: { shape: Shape }) {
  const size = FRAME[shape];
  return (
    <Stage<S>
      width={size.width}
      height={size.height}
      initial={{ saved: SAVED.before, ask: false, looked: false }}
      poster={{ saved: SAVED.after, ask: false, looked: false }}
      script={SCRIPTS[shape]}
      play="once"
      fill
      className="jc"
      cursor={shape === "tall" ? { at: { x: 270, y: 760 }, style: "touch" } : { at: { x: 1000, y: 560 }, style: "real" }}
    >
      {(s) => (
        <Host shape={shape}>
          <Month shape={shape} s={s} />
        </Host>
      )}
    </Stage>
  );
}
