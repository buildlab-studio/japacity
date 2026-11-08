// The month's end in Makoko: the results rise over the water and lead with the pay from the racks, what was kept, and
// the money held for the move filling its bar once the sheet has landed. Back to Makoko is pressed, the sheet sinks, and the brief's toast slides in under its chip as the
// month's work turns its dot green: one thing left.
import { Count, Meter, Stage, type Act } from "../../kit";
import { Column, Host, SCREEN, World } from "../../host";
import { stageFrame } from "../../frames";
import { Band, BriefChip, BriefToast, MainButton, SheetClose, Thumb } from "../../parts";
import { now, tapAt, until } from "../../timeline";
import { W, PLAYER_WATER } from "../../words";
import { BRIEF_AT_HUB, DOTS_WORKING, ITEMS_PAID } from "../life";
import { dotsOf, PaydayCard } from "../parts";
import { PAYDAY_BEAT, SAVED_WATER } from "../timings";

type S = { up: boolean; saved: number; back: boolean; told: boolean };

const SHAPE = "tall" as const;

const naira = (value: number) => `₦${Math.round(value).toLocaleString("en-GB")}`;

function Results({ s }: { s: S }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-2)" }}>{W.ageWaterLater}</div>
        <div className="jc-title">{W.done}</div>
      </div>
      <PaydayCard amount="+₦70,000" />
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-2)" }}>{W.kept}</span>
        <span className="jc-num" style={{ fontSize: 24, lineHeight: 1, color: "var(--in)" }}>
          +₦38,000
        </span>
      </div>
      <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <span className="jc-label">{W.saved}</span>
          <span className="jc-num" style={{ fontSize: 14 }}>
            <Count value={s.saved} format={naira} duration={900} /> of {naira(SAVED_WATER.required)}
          </span>
        </div>
        <Meter value={s.saved / SAVED_WATER.required} tone="ink" className="save-meter" />
      </section>
      <span data-target="back" style={{ display: "block", marginTop: 4 }}>
        <MainButton act={W.backMakoko} />
      </span>
    </div>
  );
}

function Payday({ s }: { s: S }) {
  const screen = SCREEN[SHAPE];
  return (
    <>
      <World shape={SHAPE} place="makoko" />
      <Column shape={SHAPE}>
        <div style={{ position: "absolute", left: 12, right: 12, top: screen.top }}>
          <Band name={PLAYER_WATER} age={W.ageWaterLater} place={W.room} money="₦538,000" />
        </div>
        <div className="slide" style={{ position: "absolute", left: 12, top: screen.top + 64 }} {...(s.told ? {} : { "data-out": "" })}>
          <BriefChip dots={s.told ? dotsOf(ITEMS_PAID) : DOTS_WORKING} tile={BRIEF_AT_HUB} />
        </div>
        <div className="slide" style={{ position: "absolute", left: 12, right: 12, top: screen.top + 110, transitionDelay: s.told ? "90ms" : "0ms" }} {...(s.told ? {} : { "data-out": "" })}>
          <BriefToast tile="building_flyover-span" />
        </div>
        <div style={{ position: "absolute", left: 16, bottom: 36 }}>
          <Thumb pic="🗺️" label={W.map} />
        </div>
        <div style={{ position: "absolute", right: 16, bottom: 36 }}>
          <Thumb pic="📱" label={W.phone} />
        </div>
      </Column>
      <div className="scrim" {...(s.up && !s.back ? {} : { "data-out": "" })} />
      <Column shape={SHAPE}>
        <div className="sheet" {...(s.up && !s.back ? {} : { "data-down": "" })}>
          <span className="sheet-grab" />
          <SheetClose />
          <div style={{ padding: "6px 16px 38px" }}>
            <Results s={s} />
          </div>
        </div>
      </Column>
    </>
  );
}

async function script(a: Act<S>) {
  a.mark("start");
  const start = now();
  await until(a, start, PAYDAY_BEAT.rise);
  a.put({ up: true });
  await until(a, start, PAYDAY_BEAT.fill);
  a.put({ saved: SAVED_WATER.after });
  a.mark("saved");
  await tapAt(a, SHAPE, start, "back", PAYDAY_BEAT.back);
  a.put({ back: true });
  a.mark("back");
  await until(a, start, PAYDAY_BEAT.toast);
  a.put({ told: true });
  a.mark("told");
  await until(a, start, PAYDAY_BEAT.end);
}

export function PaydayScene() {
  return (
    <Stage<S> initial={{ up: false, saved: SAVED_WATER.before, back: false, told: false }} poster={{ up: true, saved: SAVED_WATER.after, back: false, told: false }} script={script} play="once" fill className="jc" {...stageFrame(SHAPE)}>
      {(s) => (
        <Host shape={SHAPE}>
          <Payday s={s} />
        </Host>
      )}
    </Stage>
  );
}
