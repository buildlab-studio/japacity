// A step on the brief done with a tap: the brief's chip under the band is tapped and the phone rises on Japa, at the
// official page's card; the card is read at once and the phone says so; put away, the giver's toast slides in under the
// chip and the step's dot turns green.
import { Stage, type Act } from "../kit";
import { Column, Host, SCREEN, type Shape, World } from "../host";
import { shown, stageFrame } from "../frames";
import { ComingRow, Head, OfficialCard, PlanCard, WayCard } from "../japa";
import { AppScreen, Band, BriefChip, BriefToast, type Dot, Handset, Thumb } from "../parts";
import { now, tapAt, until } from "../timeline";
import { STEP_BEAT } from "../timings";
import { W } from "../words";

type S = { phone: boolean; read: boolean; done: boolean };

const BEFORE: readonly Dot[] = ["done", "later", "done", "now"];
const AFTER: readonly Dot[] = ["done", "now", "done", "done"];

function Step({ shape, s }: { shape: Shape; s: S }) {
  const screen = SCREEN[shape];
  const tall = shape === "tall";
  const phoneTop = screen.top + 116;
  const phoneBottom = tall ? 30 : 10;
  return (
    <>
      <World shape={shape} />
      <Column shape={shape}>
        <div style={{ position: "absolute", left: 12, right: 12, top: screen.top }}>
          <Band age={W.ageStart} place={W.home} money="₦1,240,000" />
        </div>
        <div style={{ position: "absolute", left: 12, top: screen.top + 66 }} data-target="chip">
          <BriefChip dots={s.done ? AFTER : BEFORE} />
        </div>
        <div className="slide" style={{ position: "absolute", left: 12, right: 12, top: screen.top + 112 }} {...(s.done ? {} : { "data-out": "" })}>
          <BriefToast />
        </div>
        <div style={{ position: "absolute", left: 16, bottom: tall ? 36 : 14 }}>
          <Thumb pic="🗺️" label={W.map} />
        </div>
        <div style={{ position: "absolute", right: 16, bottom: tall ? 36 : 14 }}>
          <Thumb pic="📱" label={W.phone} />
        </div>
      </Column>
      <div className="scrim" {...(s.phone ? {} : { "data-out": "" })} />
      <Column shape={shape}>
        <Handset away={!s.phone} style={{ left: 10, right: 10, top: phoneTop, bottom: phoneBottom }}>
          <AppScreen>
          <PlanCard ready={0.08} />
          <Head>{W.others}</Head>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <WayCard tile="building_rye-lane-terrace_a" name={W.skilled} state={W.heard} compact={!tall} />
            <WayCard tile="building_rye-lane-terrace_a" name={W.care} state={W.heard} compact={!tall} />
          </div>
          {tall ? (
            <>
              <Head>{W.coming}</Head>
              <ComingRow />
            </>
          ) : null}
          <OfficialCard target="official" />
          </AppScreen>
        </Handset>
        <div className="rise" style={{ position: "absolute", left: 20, right: 20, top: phoneTop - 64, display: "flex", justifyContent: "center" }} {...(s.read && s.phone ? {} : { "data-out": "" })}>
          <p className="talk-corner" role="status" style={{ margin: 0, padding: "6px 16px", textAlign: "center", fontSize: 14, lineHeight: 1.3, fontWeight: 700 }}>
            {W.officialRead}
          </p>
        </div>
        <span data-target="away" style={{ position: "absolute", left: "50%", bottom: phoneBottom + 4, width: 160, height: 24, translate: "-50% 0" }} />
      </Column>
    </>
  );
}

function script(shape: Shape) {
  return async (a: Act<S>) => {
    a.mark("start");
    const start = now();
    await tapAt(a, shape, start, "chip", STEP_BEAT.chip);
    a.put({ phone: true });
    a.mark("phone");
    await tapAt(a, shape, start, "official", STEP_BEAT.card);
    a.put({ read: true });
    a.mark("read");
    await tapAt(a, shape, start, "away", STEP_BEAT.away);
    a.put({ phone: false });
    await a.wait(260);
    a.put({ done: true });
    a.mark("done");
    await until(a, start, STEP_BEAT.end);
  };
}

const SCRIPTS = { wide: script("wide"), tall: script("tall") };

export function StepScene({ shape }: { shape: Shape }) {
  return (
    <Stage<S>
      initial={{ phone: false, read: false, done: false }}
      poster={{ phone: false, read: true, done: true }}
      script={SCRIPTS[shape]}
      play="once"
      fill
      className="jc"
      {...stageFrame(shape)}
    >
      {(s, _rect, layout) => (
        <Host shape={shown(shape, layout)}>
          <Step shape={shown(shape, layout)} s={s} />
        </Host>
      )}
    </Stage>
  );
}
