// Settings (world:phone-rises-over-scene, world:interface-sounds-made-live): the sound (the game's one mute: muted, nothing is fetched), the city's
// graphics choice, and
// the account, which the shell hands in so this folder never imports the account feature. Last,
// "Start a new life" (account:start-a-new-life): one sheet that names the character and their age,
// Cancel first, and the end held to confirm, with nothing to type. At the foot, the version line (city.md
// city:credits-screen-attributions): five taps on it open the dedication page (account:dedication-page-and-its-doors), which the
// shell hands in, and nothing else happens.
import { RotateCcw, Sparkles, Volume2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useGame } from "../../../authority/GameProvider";
import { pageOf } from "../../../shared/datapage/PageSheet";
import { ModerationRows } from "../../../shared/moderation/Feedback";
import { chooseGraphics, type GraphicsChoice } from "../../../shared/graphics/mode";
import { setMuted } from "../../../shared/sound/sound";
import { buildOf } from "../../../shared/build-stamp/stamp";
import { useSound } from "../../../shared/sound/useSound";
import { Button } from "../../../shared/ui/Button";
import { Sheet } from "../../../shared/ui/Sheet";
import { clockWords } from "../../../shared/words/quality";
import { say } from "../../../shared/words/text";
import { Chips, Head } from "../act";
import { PicTile } from "../ui";
import { GRAPHICS_KEY } from "../../../shared/storage/storage";

// The city reads the graphics choice (GRAPHICS_KEY, shared/scene/mode.ts) when it opens, so a choice made here
// applies when the city next opens, not at once.
const GRAPHICS: readonly GraphicsChoice[] = ["auto", "low", "high"];

function readGraphics(): GraphicsChoice {
  try {
    const kept = localStorage.getItem(GRAPHICS_KEY);
    return kept === "low" || kept === "high" ? kept : "auto";
  } catch {
    return "auto";
  }
}

function keepGraphics(choice: GraphicsChoice): void {
  try {
    localStorage.setItem(GRAPHICS_KEY, choice);
  } catch {
    // A private window may refuse storage; the choice then lasts the session only.
  }
}

/** The dedication page as the shell hands it in: drawn open or closed, with the way to close it (account:dedication-page-and-its-doors). */
export type DedicationScreen = (open: boolean, onClose: () => void) => ReactNode;

export function Settings({ account = null, about = null, dedication = null }: { account?: ReactNode; about?: ReactNode; dedication?: DedicationScreen | null }) {
  const [graphics, setGraphics] = useState<GraphicsChoice>(readGraphics);
  const muted = useSound((state) => state.muted);
  return (
    <div data-phone-app="settings">
      {/* The account first, as one full row (account:guest-reminded-to-secure): a small icon there reads as a heading. */}
      {account === null ? null : <div data-account>{account}</div>}
      {/* The sound and the city's graphics in one card: each a name with its icon and one
          segmented pill. */}
      <div className="lively-card flex flex-col gap-3 p-3.5" data-settings-card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[17px] font-bold">
          <Volume2 size={20} aria-hidden />
          {say("phone.settings.sound")}
        </h3>
      <Chips
        label={say("phone.settings.sound")}
        value={muted ? "off" : "on"}
        onChange={(next) => setMuted(next === "off")}
        options={[
          { value: "on", label: say("phone.settings.sound.on") },
          { value: "off", label: say("phone.settings.sound.off") },
        ]}
      />
      </div>
      <div className="h-px bg-sheet-line" aria-hidden />
      <h3 className="flex items-center gap-2 text-[17px] font-bold">
        <Sparkles size={20} aria-hidden />
        {say("phone.settings.graphics")}
      </h3>
      <Chips
        label={say("phone.settings.graphics")}
        value={graphics}
        onChange={(next) => {
          chooseGraphics(next);
          keepGraphics(next);
          setGraphics(next);
        }}
        options={GRAPHICS.map((value) => ({ value, label: say(`phone.settings.graphics.${value}`) }))}
      />
      <p className="text-[13px] text-text-2">{say("phone.settings.graphics.when")}</p>
      </div>

      {/* moderation:feedback-box-in-settings, moderation:actioned-player-told-and-appeals: the feedback box and the team's notice, in the game's menu. */}
      <ModerationRows />
      {about === null ? null : (
        <>
          <Head>{say("phone.settings.about")}</Head>
          <div data-about>{about}</div>
        </>
      )}

      <NewLife />
      <VersionLine dedication={dedication} />
    </div>
  );
}

/** city:credits-screen-attributions: the taps on the version line that open the dedication, and the time they fall within. */
export const DEDICATION_TAPS = 5;
export const DEDICATION_WINDOW_MS = 5000;

/** The build as the version line says it: the short commit of the page's stamp (server:production-and-staging), or null with none. */
export function versionOf(stamp: string | null): string | null {
  const commit = stamp?.split("+")[0] ?? "";
  if (commit === "" || commit === "unknown") return null;
  return /^[0-9a-f]{7,}$/.test(commit) ? commit.slice(0, 7) : commit;
}

/**
 * The version line, last in Settings: "Version" and the build, quiet. Five taps within about five
 * seconds open the dedication page (city:credits-screen-attributions, account:dedication-page-and-its-doors); nothing else happens:
 * no sound, no line, no link, and a sixth tap changes nothing. A tap anywhere else starts the count again, and so does
 * closing the page. Nothing of it is counted or sent.
 */
function VersionLine({ dedication }: { dedication: DedicationScreen | null }) {
  const version = typeof document === "undefined" ? null : versionOf(buildOf(document));
  const [open, setOpen] = useState(false);
  const taps = useRef<number[]>([]);
  const line = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (event: PointerEvent): void => {
      if (event.target instanceof Node && line.current?.contains(event.target) === true) return;
      taps.current = [];
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, []);
  const tap = (): void => {
    if (open) return;
    const now = Date.now();
    taps.current = [...taps.current.filter((at) => now - at < DEDICATION_WINDOW_MS), now];
    if (taps.current.length >= DEDICATION_TAPS) {
      taps.current = [];
      setOpen(true);
    }
  };
  return (
    <div ref={line} className="mt-5 border-t border-sheet-line" data-version>
      <button
        type="button"
        onClick={tap}
        className="flex min-h-11 w-full touch-manipulation items-center justify-between gap-2 py-2 text-left text-[14px] select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span className="font-semibold">{say("phone.settings.version")}</span>
        <span className="text-text-2 tabular-nums" data-version-build>
          {version ?? say("phone.settings.version.local")}
        </span>
      </button>
      {dedication?.(open, () => setOpen(false)) ?? null}
    </div>
  );
}

/** account:start-a-new-life: how long the ending button is held before the life ends. */
export const HOLD_MS = 1500;

/** The ending button: it ends only when held for HOLD_MS, by a finger, a mouse, or Enter or Space; letting go sooner does nothing. */
function HoldToEnd({ onDone, disabled }: { onDone: () => void; disabled: boolean }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const stop = (): void => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  const start = (): void => {
    if (disabled || timer.current !== null) return;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onDone();
    }, HOLD_MS);
  };
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  const held = (key: string): boolean => key === " " || key === "Enter";
  return (
    <button
      type="button"
      disabled={disabled}
      className="relative min-h-12 w-full touch-none overflow-hidden rounded-md border-2 border-bad bg-sheet-2 px-4 font-semibold text-bad select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-45"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(event) => {
        if (!held(event.key)) return;
        event.preventDefault();
        if (!event.repeat) start();
      }}
      onKeyUp={(event) => {
        if (held(event.key)) stop();
      }}
      onBlur={stop}
      onContextMenu={(event) => event.preventDefault()}
      data-life-end-hold={holding ? "holding" : "idle"}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 bg-bad/20" style={{ width: holding ? "100%" : "0%", transition: holding ? `width ${String(HOLD_MS)}ms linear` : "none" }} />
      <span className="relative">{say(holding ? "ui.life.end.holding" : "ui.life.end.hold")}</span>
    </button>
  );
}

/** "Start a new life": the row in Settings and its one sheet. Shown only while a life is playing and the authority can end it. */
function NewLife() {
  const view = useGame((state) => state.view);
  const endLife = useGame((state) => state.endLife);
  const [open, setOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [failed, setFailed] = useState(false);
  if (endLife === null || view === null) return null;
  const page = pageOf(view);
  // The age as the band's clock says it: the page's own is years only (prologue:front-door-builds-a-person).
  const age = clockWords(view.qualities);
  const who = page.name === "" ? age : say("ui.life.end.who", { name: page.name, age });
  // A real partner or sibling joined to this life hears that it ended (account:start-a-new-life).
  const linked = view.people.bonds.some((bond) => bond.pair !== null && bond.stage !== "ended");
  const end = async (): Promise<void> => {
    setEnding(true);
    setFailed(false);
    const ended = await endLife();
    setEnding(false);
    if (!ended) setFailed(true);
  };
  return (
    <>
      <Head>{say("ui.life.end.heading")}</Head>
      <button
        type="button"
        className="lively-card press flex w-full items-center gap-3 p-3 text-left"
        onClick={() => {
          setFailed(false);
          setOpen(true);
        }}
        data-life-end
      >
        <PicTile of="place.family-house" size={52} tint="plain" />
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-bold">{say("ui.life.end")}</span>
          <span className="block text-[14px] text-text-2">{say("ui.life.end.hint")}</span>
        </span>
        <RotateCcw size={20} className="shrink-0" aria-hidden />
      </button>
      <Sheet open={open} onOpenChange={(next) => (ending ? undefined : setOpen(next))} title={say("ui.life.end")}>
        <div className="flex flex-col gap-3" data-life-end-sheet>
          <p className="text-lg font-semibold" data-life-end-who>
            {who}
          </p>
          <p>{say("ui.life.end.warn")}</p>
          <p className="text-text-2">{say("ui.life.end.next")}</p>
          {linked ? <p className="text-text-2">{say("ui.life.end.linked")}</p> : null}
          <div className="mt-2 flex flex-col gap-3">
            <Button variant="primary" disabled={ending} onClick={() => setOpen(false)}>
              {say("ui.life.end.keep")}
            </Button>
            <HoldToEnd disabled={ending} onDone={() => void end()} />
          </div>
          {ending ? <p role="status">{say("ui.life.end.ending")}</p> : null}
          {failed ? (
            <p role="alert" className="text-bad">
              {say("ui.life.end.failed")}
            </p>
          ) : null}
        </div>
      </Sheet>
    </>
  );
}
