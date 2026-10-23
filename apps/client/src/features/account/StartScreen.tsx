// The start screen online (account:start-screen-over-live-city):
// over the scene with the lockup at the head of the sheet, no title over the figure, a hook in two rows (text:hook-not-explanation; one of three
// lines, picked once per visit, account:two-lights-and-wink-lines), the whole game in three steps as an icon and a word each, then the two
// doors at the same height: Play with its small second line, and "Sign in" outlined under it with its own. In a browser a saved life
// was open in (marks.ts), the doors turn round: "Sign in" first with its line, "Start a new life" under it. Inside an app's own
// browser a quiet line under the doors says the life is saved in the browser it is played in, with the way out to the
// phone's own (account:guest-secures-the-life); Play still works right there. The two lights hang over the
// top of the scene (TwoLights.tsx), so a line about the light is a caption. Nothing says Lagos: the scene behind does.
import { useId, useSyncExternalStore } from "react";

import { StartHook } from "../../shared/front-door/Hook";
import { Wordmark } from "../../shared/ui/Wordmark";
import { say } from "../../shared/words/text";
import { OpenInBrowser } from "./OpenInBrowser";

export interface StartScreenProps {
  onPlay: () => void;
  onReturning: () => void;
  /** A saved life was open in this browser: the way back in comes first. */
  kept?: boolean;
  /** Inside an app's own browser: its user agent, for the way out; null in the phone's own browser. */
  inApp?: { agent: string; href?: string } | null;
}

/** The lesser door: the sheet's outlined button, as tall as the main one. */
const SECOND_DOOR = "press mt-2 flex h-[58px] w-full items-center justify-between rounded-[6px] border-2 border-action bg-transparent px-[18px] text-[17px] font-extrabold text-text";

/** The paint on the root, the attribute the paint's tokens follow (shared/world/paint.ts), read without setting it. */
function rootPaint(): "day" | "night" {
  return typeof document !== "undefined" && document.documentElement.dataset.paint === "night" ? "night" : "day";
}

function watchRootPaint(changed: () => void): () => void {
  if (typeof MutationObserver === "undefined") return () => undefined;
  const watch = new MutationObserver(changed);
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-paint"] });
  return () => watch.disconnect();
}

/** The sheet's paint as the root carries it, followed as the world's clock turns it. */
function useRootPaint(): "day" | "night" {
  return useSyncExternalStore(watchRootPaint, rootPaint, () => "day");
}

/** A door's small second line, at the end of the button and said as its description (Play's "Free · no sign-up", Sign in's "Carry on a saved life"). */
function DoorLine({ id, words }: { id: string; words: string }) {
  return (
    <span id={id} className="text-[13px] font-semibold opacity-80">
      {words}
    </span>
  );
}

export function StartScreen({ onPlay, onReturning, kept = false, inApp = null }: StartScreenProps) {
  const then = useId();
  const carryOn = useId();
  const signIn = say("ui.account.start.returning.then");
  return (
    <div className="flex flex-col" data-start-screen={kept ? "kept" : "new"}>
      {/* The lockup for the ground under it, the sheet's own paint, so the whole lockup shows and not the J mark alone. */}
      <Wordmark ground={useRootPaint() === "night" ? "dark" : "light"} align="start" className="mb-3" />
      <StartHook />
      {kept ? (
        <>
          <button type="button" className="btn-main mt-4" onClick={onReturning} aria-label={say("ui.account.start.kept.returning")} aria-describedby={carryOn}>
            <span>{say("ui.account.start.kept.returning")}</span>
            <DoorLine id={carryOn} words={signIn} />
          </button>
          <button type="button" className={SECOND_DOOR} onClick={onPlay}>
            {say("ui.account.start.kept.play")}
          </button>
        </>
      ) : (
        <>
          {/* The button is named Play; its second line is said as its description. */}
          <button type="button" className="btn-main mt-4" onClick={onPlay} aria-label={say("ui.account.start.play")} aria-describedby={then}>
            <span>{say("ui.account.start.play")}</span>
            <DoorLine id={then} words={say("ui.account.start.play.then")} />
          </button>
          <button type="button" className={SECOND_DOOR} onClick={onReturning} aria-label={say("ui.account.start.returning")} aria-describedby={carryOn}>
            <span>{say("ui.account.start.returning")}</span>
            <DoorLine id={carryOn} words={signIn} />
          </button>
        </>
      )}
      {inApp === null ? null : (
        <div className="mt-3 flex flex-col items-start gap-2" data-start-in-app>
          <p className="text-[13px] leading-snug text-text-2">{say("ui.account.in-app.start")}</p>
          <OpenInBrowser agent={inApp.agent} {...(inApp.href === undefined ? {} : { href: inApp.href })} />
        </div>
      )}
    </div>
  );
}
