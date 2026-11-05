// The road out: the phone's home screen, Japa tapped, and the app opens on the plan, a master's in the UK, with the other
// ways out beside it: skilled work in the UK, health care in the UK, a contract in the Gulf.
import { Stage, type Act } from "../kit";
import { Column, FRAME, Host, SCREEN, type Shape, World } from "../host";
import { ComingRow, Head, HomeScreen, PlanCard, WayCard } from "../japa";
import { AppScreen, Band, Handset } from "../parts";
import { now, tapAt, until } from "../timeline";
import { WAYS_BEAT } from "../timings";
import { W } from "../words";

type S = { app: boolean };

function Ways({ shape, s }: { shape: Shape; s: S }) {
  const screen = SCREEN[shape];
  const tall = shape === "tall";
  const top = screen.top + (tall ? 70 : 62);
  return (
    <>
      <World shape={shape} />
      <Column shape={shape}>
        <div style={{ position: "absolute", left: 12, right: 12, top: screen.top }}>
          <Band age={W.ageLater} place={W.home} money="₦2,502,000" />
        </div>
      </Column>
      <div className="scrim" />
      <Column shape={shape}>
        <Handset away={false} style={{ left: 10, right: 10, top, bottom: tall ? 30 : 10 }}>
          <HomeScreen />
          <div className="app-open" {...(s.app ? {} : { "data-out": "" })}>
            <AppScreen>
              <PlanCard ready={0.62} />
              <Head>{W.others}</Head>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <WayCard tile="building_rye-lane-terrace_a" name={W.skilled} state={W.known} compact={!tall} />
                <WayCard tile="building_rye-lane-terrace_a" name={W.care} state={W.heard} compact={!tall} />
                <WayCard tile="building_deira-arcade_a" name={W.gulf} state={W.heard} compact={!tall} />
              </div>
              {tall ? (
                <>
                  <Head>{W.coming}</Head>
                  <ComingRow />
                </>
              ) : null}
            </AppScreen>
          </div>
        </Handset>
      </Column>
    </>
  );
}

function script(shape: Shape) {
  return async (a: Act<S>) => {
    a.mark("start");
    const start = now();
    await tapAt(a, shape, start, "japa", WAYS_BEAT.japa);
    a.put({ app: true });
    a.mark("app");
    await until(a, start, WAYS_BEAT.end);
  };
}

const SCRIPTS = { wide: script("wide"), tall: script("tall") };

export function WaysScene({ shape }: { shape: Shape }) {
  const size = FRAME[shape];
  return (
    <Stage<S>
      width={size.width}
      height={size.height}
      initial={{ app: false }}
      poster={{ app: true }}
      script={SCRIPTS[shape]}
      play="once"
      fill
      className="jc"
      cursor={shape === "tall" ? { at: { x: 270, y: 760 }, style: "touch" } : { at: { x: 1000, y: 560 }, style: "real" }}
    >
      {(s) => (
        <Host shape={shape}>
          <Ways shape={shape} s={s} />
        </Host>
      )}
    </Stage>
  );
}
