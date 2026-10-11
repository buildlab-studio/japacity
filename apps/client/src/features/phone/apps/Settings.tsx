// Settings (docs/rules/world.md R-WORLD-018, 021, 022): the look (adire or danfo, remembered on the
// device), the sound (the existing mute: muted fetches nothing), the city's graphics choice, and
// the account, which the shell hands in so this folder never imports the account feature. Last,
// "Start a new life" (account.md R-ACCOUNT-030): one sheet that names the character and their age,
// Cancel first, and the end held to confirm, with nothing to type. At the foot, the version line (city.md
// R-CITY-021): five taps on it show the dedication, and nothing else happens.
import { DEDICATION } from "@japacity/content";
import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useGame } from "../../../authority/GameProvider";
import { pageOf } from "../../../shared/datapage/PageSheet";
import { chooseGraphics, type GraphicsChoice } from "../../../shared/graphics/mode";
import { setMuted } from "../../../shared/sound/sound";
import { buildOf } from "../../../shared/stamp/stamp";
import { useSound } from "../../../shared/sound/useSound";
import { Button } from "../../../shared/ui/Button";
import { Sheet } from "../../../shared/ui/Sheet";
import { clockWords } from "../../../shared/words/quality";
import { say } from "../../../shared/words/text";
import type { Theme } from "../../../shared/world/contract";
import { currentTheme, setTheme, THEMES } from "../../../shared/world/theme";
import { Chips, Head } from "../act";
import { phoneWords } from "../phone.words";

// the city keeps its graphics choice under this key (features/city/mode.ts) and reads it
// when it opens; a shared home for the key, and a way for the city to hear a change, would let the
// phone's choice apply at once.
export const GRAPHICS_KEY = "japacity.city.graphics";
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

export function Settings({ account = null, about = null }: { account?: ReactNode; about?: ReactNode }) {
  const [theme, chooseTheme] = useState<Theme>(() => currentTheme());
  const [graphics, setGraphics] = useState<GraphicsChoice>(readGraphics);
  const muted = useSound((state) => state.muted);
  return (
    <div data-phone-app="settings">
      <Head>{phoneWords("phone.settings.look")}</Head>
      <Chips
        label={phoneWords("phone.settings.look")}
        value={theme}
        onChange={(next) => {
          setTheme(next);
          chooseTheme(next);
        }}
        options={THEMES.map((value) => ({ value, label: say(`ui.world.theme.${value}`) }))}
      />

      <Head>{phoneWords("phone.settings.sound")}</Head>
      <Chips
        label={phoneWords("phone.settings.sound")}
        value={muted ? "off" : "on"}
        onChange={(next) => setMuted(next === "off")}
        options={[
          { value: "on", label: phoneWords("phone.settings.sound.on") },
          { value: "off", label: phoneWords("phone.settings.sound.off") },
        ]}
      />

      <Head>{phoneWords("phone.settings.graphics")}</Head>
      <Chips
        label={phoneWords("phone.settings.graphics")}
        value={graphics}
        onChange={(next) => {
          chooseGraphics(next);
          keepGraphics(next);
          setGraphics(next);
        }}
        options={GRAPHICS.map((value) => ({ value, label: phoneWords(`phone.settings.graphics.${value}`) }))}
      />
      <p className="mt-1 text-[12px] text-text-2">{phoneWords("phone.settings.graphics.when")}</p>

      {account === null ? null : <div data-account>{account}</div>}
      {about === null ? null : (
        <>
          <Head>{phoneWords("phone.settings.about")}</Head>
          <div data-about>{about}</div>
        </>
      )}

      <NewLife />
      <VersionLine />
    </div>
  );
}

/** R-CITY-021: the taps on the version line that show the dedication, and the time they fall within. */
export const DEDICATION_TAPS = 5;
export const DEDICATION_WINDOW_MS = 5000;

/** The build as the version line says it: the short commit of the page's stamp (R-SERVER-038), or null with none. */
export function versionOf(stamp: string | null): string | null {
  const commit = stamp?.split("+")[0] ?? "";
  if (commit === "" || commit === "unknown") return null;
  return /^[0-9a-f]{7,}$/.test(commit) ? commit.slice(0, 7) : commit;
}

/**
 * The version line, last in Settings, in the design's form: "Version" and the build, quiet. Five taps within about five
 * seconds show the dedication just under it, simply: no sound, no sheet, no animation, no link, and a sixth tap
 * changes nothing. A tap anywhere else, or leaving Settings, hides it and starts the count again. Nothing of it is
 * counted or sent.
 */
function VersionLine() {
  const version = typeof document === "undefined" ? null : versionOf(buildOf(document));
  const [shown, setShown] = useState(false);
  const taps = useRef<number[]>([]);
  const line = useRef<HTMLDivElement>(null);
  const dedication = useRef<HTMLParagraphElement>(null);
  // The line shows under the version, at the foot of a screen that scrolls: it is brought into view as it appears, at once
  // and with no motion of its own, so the home bar never cuts it.
  useEffect(() => {
    if (shown) dedication.current?.scrollIntoView?.({ block: "nearest" });
  }, [shown]);
  useEffect(() => {
    const away = (event: PointerEvent): void => {
      if (event.target instanceof Node && line.current?.contains(event.target) === true) return;
      taps.current = [];
      setShown(false);
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, []);
  const tap = (): void => {
    if (shown) return;
    const now = Date.now();
    taps.current = [...taps.current.filter((at) => now - at < DEDICATION_WINDOW_MS), now];
    if (taps.current.length >= DEDICATION_TAPS) setShown(true);
  };
  return (
    <div ref={line} className="mt-4 border-t border-sheet-line" data-version>
      <button
        type="button"
        onClick={tap}
        className="flex min-h-11 w-full touch-manipulation items-center justify-between gap-2 py-2 text-left text-[14px] select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span className="font-semibold">{phoneWords("phone.settings.version")}</span>
        <span className="text-text-2 tabular-nums" data-version-build>
          {version ?? phoneWords("phone.settings.version.local")}
        </span>
      </button>
      {shown ? (
        <p ref={dedication} className="scroll-mb-3 pt-1 pb-2.5 text-[13px] leading-relaxed text-text-2" data-dedication>
          {DEDICATION}
        </p>
      ) : null}
    </div>
  );
}

/** R-ACCOUNT-030: how long the ending button is held before the life ends. */
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
  // The age as the band's clock says it: the page's own is years only (R-PROLOGUE-009).
  const age = clockWords(view.qualities);
  const who = page.name === "" ? age : say("ui.life.end.who", { name: page.name, age });
  // A real partner or sibling joined to this life hears that it ended (R-ACCOUNT-030).
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
        className="press flex w-full items-center justify-between gap-2 rounded-[5px] border border-sheet-line px-3 py-2 text-left"
        onClick={() => {
          setFailed(false);
          setOpen(true);
        }}
        data-life-end
      >
        <span className="min-w-0">
          <span className="block text-[14px] font-extrabold">{say("ui.life.end")}</span>
          <span className="block text-[12px] text-text-2">{say("ui.life.end.hint")}</span>
        </span>
        <RotateCcw size={16} className="shrink-0" aria-hidden />
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
