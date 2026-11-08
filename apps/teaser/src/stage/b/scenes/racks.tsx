// The hook: Makoko on the lagoon with the racks' card already up, and Start work pressed within the first second. The
// sheet sinks, the world comes up from under its scrim, and the act's toast slides in under the band, the brief's chip
// under it, the job the thing to do.
import { Stage, type Act } from "../../kit";
import { Column, Host, SCREEN, World } from "../../host";
import { stageFrame } from "../../frames";
import { Band, BriefChip, Thumb } from "../../parts";
import { now, tapAt, until } from "../../timeline";
import { W, PLAYER_WATER } from "../../words";
import { BRIEF_AT_MAKOKO, ITEMS_START } from "../life";
import { ActCard, ActToast, dotsOf } from "../parts";
import { RACKS_BEAT } from "../timings";

type S = { started: boolean; told: boolean };

const SHAPE = "tall" as const;

function Racks({ s }: { s: S }) {
  const screen = SCREEN[SHAPE];
  return (
    <>
      <World shape={SHAPE} place="makoko" />
      <Column shape={SHAPE}>
        <div style={{ position: "absolute", left: 12, right: 12, top: screen.top }}>
          <Band name={PLAYER_WATER} age={W.ageWater} place={W.room} money="₦500,000" />
        </div>
        <div className="slide" style={{ position: "absolute", left: 12, right: 12, top: screen.top + 64 }} {...(s.told ? {} : { "data-out": "" })}>
          <ActToast />
        </div>
        <div className="slide" style={{ position: "absolute", left: 12, top: screen.top + 146, transitionDelay: s.told ? "90ms" : "0ms" }} {...(s.told ? {} : { "data-out": "" })}>
          <BriefChip dots={dotsOf(ITEMS_START)} tile={BRIEF_AT_MAKOKO} />
        </div>
        <div style={{ position: "absolute", left: 16, bottom: 36 }}>
          <Thumb pic="🗺️" label={W.map} />
        </div>
        <div style={{ position: "absolute", right: 16, bottom: 36 }}>
          <Thumb pic="📱" label={W.phone} />
        </div>
      </Column>
      <div className="scrim" {...(s.started ? { "data-out": "" } : {})} />
      <Column shape={SHAPE}>
        <ActCard target="start" down={s.started} />
      </Column>
    </>
  );
}

async function script(a: Act<S>) {
  a.mark("start");
  const start = now();
  await tapAt(a, SHAPE, start, "start", RACKS_BEAT.press);
  a.put({ started: true });
  a.mark("pressed");
  await until(a, start, RACKS_BEAT.toast);
  a.put({ told: true });
  a.mark("told");
  await until(a, start, RACKS_BEAT.end);
}

export function RacksScene() {
  return (
    <Stage<S> initial={{ started: false, told: false }} poster={{ started: true, told: true }} script={script} play="once" fill className="jc" {...stageFrame(SHAPE)}>
      {(s) => (
        <Host shape={SHAPE}>
          <Racks s={s} />
        </Host>
      )}
    </Stage>
  );
}
