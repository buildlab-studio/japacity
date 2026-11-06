// The road: the brief's chip under the band is tapped and the game's phone rises on Japa at the brief it carries, the
// way out heard of at a send-off first and ticked, the job and its month ticked, the page at the hub the one to do. The
// finger moves the app down to the ways out, four in the game's order, and they hold.
import { Scroll, Stage, type Act } from "../../kit";
import { Column, Host, SCREEN, World } from "../../host";
import { stageFrame } from "../../frames";
import { Head, WayCard } from "../../japa";
import { AppScreen, Band, BriefChip, Handset, Thumb } from "../../parts";
import { now, tapAt, until } from "../../timeline";
import { W, PLAYER_WATER } from "../../words";
import { BRIEF_AT_HUB, ITEMS_PAID } from "../life";
import { CarriedBrief, dotsOf } from "../parts";
import { ROAD_BEAT } from "../timings";

type S = { phone: boolean };

const SHAPE = "tall" as const;

/** The four ways out in the game's order, each with the picture the game gives its country. */
const WAYS = [
  { name: W.masters, tile: "building_rye-lane-terrace_a" },
  { name: W.skilled, tile: "building_rye-lane-terrace_a" },
  { name: W.care, tile: "building_rye-lane-terrace_a" },
  { name: W.gulf, tile: "building_deira-arcade_a" },
] as const;

function Dots() {
  return (
    <span className="brief-dots" aria-hidden>
      {dotsOf(ITEMS_PAID).map((dot, index) => (
        <i key={index} className="brief-dot" data-dot={dot} />
      ))}
    </span>
  );
}

function Road({ s }: { s: S }) {
  const screen = SCREEN[SHAPE];
  const phoneTop = screen.top + 116;
  return (
    <>
      <World shape={SHAPE} place="makoko" />
      <Column shape={SHAPE}>
        <div style={{ position: "absolute", left: 12, right: 12, top: screen.top }}>
          <Band name={PLAYER_WATER} age={W.ageWaterLater} place={W.room} money="₦538,000" />
        </div>
        <div style={{ position: "absolute", left: 12, top: screen.top + 64 }} data-target="chip">
          <BriefChip dots={dotsOf(ITEMS_PAID)} tile={BRIEF_AT_HUB} />
        </div>
        <div style={{ position: "absolute", left: 16, bottom: 36 }}>
          <Thumb pic="🗺️" label={W.map} />
        </div>
        <div style={{ position: "absolute", right: 16, bottom: 36 }}>
          <Thumb pic="📱" label={W.phone} />
        </div>
      </Column>
      <div className="scrim" {...(s.phone ? {} : { "data-out": "" })} />
      <Column shape={SHAPE}>
        {/* The phone rises to the screen's foot, its own foot past the frame, so the ways out have the room the app gives them. */}
        <Handset away={!s.phone} style={{ left: 10, right: 10, top: phoneTop, bottom: 0 }}>
          <AppScreen>
            <Scroll name="app" bar="none" className="app-scroll">
              <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 12 }}>
                <Head>{W.briefs}</Head>
                <CarriedBrief items={ITEMS_PAID} tile={BRIEF_AT_HUB} dots={<Dots />} />
                <div data-target="ways" style={{ paddingTop: 4 }}>
                  <Head>{W.others}</Head>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {WAYS.map((way) => (
                    <WayCard key={way.name} tile={way.tile} name={way.name} state={W.heard} />
                  ))}
                </div>
              </div>
            </Scroll>
          </AppScreen>
        </Handset>
      </Column>
    </>
  );
}

async function script(a: Act<S>) {
  a.mark("start");
  const start = now();
  await tapAt(a, SHAPE, start, "chip", ROAD_BEAT.chip);
  a.put({ phone: true });
  a.mark("phone");
  await until(a, start, ROAD_BEAT.ways - 400);
  await a.scroll("app", "ways", { duration: 800, offset: 4 });
  a.mark("ways");
  await until(a, start, ROAD_BEAT.end);
}

export function RoadScene() {
  return (
    <Stage<S> initial={{ phone: false }} poster={{ phone: true }} script={script} play="once" fill className="jc" {...stageFrame(SHAPE)}>
      {(s) => (
        <Host shape={SHAPE}>
          <Road s={s} />
        </Host>
      )}
    </Stage>
  );
}
