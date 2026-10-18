// The month's acts telling of themselves on the phone (world:month-passes-as-lived): on the
// wallpaper, as notifications, once the character is home (the house or the room), newest first,
// and told as soon as they show; away from home only that something waits, never the lines. The
// lines stay on the phone for the rest of the month. A paper that landed or moved is told above
// them wherever the phone is opened, a message from the office, and a tap opens Papers; it waits
// there until Papers is opened, and nothing opens by itself. A result whose morning has come (clock:envelopes-show-real-waits)
// is told first of all, a notice from its office, once. Nothing here sends a command.
import type { Envelope, PlayerView } from "@japacity/sim";
import { FolderOpen } from "lucide-react";
import { use, useEffect, useRef, useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { dueSignals, waitingSignals } from "../../shared/days/days";
import { tellSignals, useMonthDays } from "../../shared/days/days.store";
import { atHome } from "../../shared/days/standing";
import { PhoneNav } from "../../shared/phone/nav";
import { Tile } from "../../shared/tiles/Tile";
import { formatBand } from "../../shared/words/format";
import { runningName, say } from "../../shared/words/text";
import { paperNotices, paperNoticeWords, papersMarkOf } from "./papers";
import { markSeen, useSeen } from "./seen";

/** The lines due and those still waiting, from the days kept, the view and the plan. */
function useSignals(): { due: ReturnType<typeof dueSignals>; waiting: ReturnType<typeof waitingSignals> } {
  const view = useView();
  const plan = useGame((state) => state.plan);
  const days = useMonthDays();
  if (days === null || days.month !== view.month || days.scenario !== view.scenario) return { due: [], waiting: [] };
  return { due: dueSignals(days, view, plan), waiting: waitingSignals(days, view, plan) };
}

/** True while a line of the month waits to be told: part of the Phone button's dot. */
export function useSignalsWaiting(): boolean {
  return useSignals().waiting.length > 0;
}

/** An opened result's office and what it says (clock:envelopes-show-real-waits): the test centre's band, the endorsing body, the visa centre's decision, told straight. */
function envelopeWords(envelope: Envelope, view: Pick<PlayerView, "routes">): { from: string | null; words: string } {
  if (envelope.kind === "route") {
    const refused = envelope.held.some((line) => line.key.startsWith("line.route.refused")) || view.routes.find((route) => route.id === envelope.id)?.state === "refused";
    return { from: say("phone.morning.from.route"), words: say(refused ? "phone.morning.route.refused" : "phone.morning.route.granted") };
  }
  const own = `phone.morning.${envelope.id}`;
  const band = envelope.held.map((line) => line.params.band).find((value) => typeof value === "number");
  if (say(own) === own) return { from: null, words: say("phone.papers.notice.issued", { paper: runningName(envelope.id) }) };
  return { from: say(`phone.morning.from.${envelope.id}`), words: say(own, { band: band === undefined ? "" : formatBand(band) }) };
}

/** The picture of a result by what it is: the test desk for a band, the desk for the endorsement, the visa centre for a decision. */
const ENVELOPE_PICTURE: Readonly<Record<string, string>> = {
  "document.english-test": "activity.sit-english-test",
  "document.endorsement": "activity.apply-endorsement",
  "document.tb-certificate": "activity.tb-test",
  "document.police-certificate": "activity.get-police-certificate",
};

/** The id whose tile is an envelope's picture. */
function envelopePicture(envelope: Envelope): string {
  return envelope.kind === "route" ? "place.visa-centre" : (ENVELOPE_PICTURE[envelope.id] ?? "place.passport-office");
}

/**
 * The results whose morning has come, first on the wallpaper, each a notice from its office (clock:envelopes-show-real-waits):
 * the first a white card with its picture, its office and what it says, large; any others under
 * "Also this morning", smaller. The best thing leads; nothing is louder than it.
 */
function MorningNotices({ told }: { told: readonly Envelope[] }) {
  const view = useView();
  if (told.length === 0) return null;
  const [first, ...rest] = told;
  return (
    <div className="mt-4 flex flex-col gap-2 px-4" aria-label={say("phone.morning.notices")} role="list" data-morning>
      {first === undefined ? null : (
        <div role="listitem" className="morning-card pop flex items-center gap-3 p-3 text-left text-text" data-envelope={first.id} data-envelope-first>
          <span className="flex size-[72px] shrink-0 items-center justify-center rounded-[16px] bg-[var(--soft)]">
            <span className="sticker-cut" style={{ rotate: "-6deg" }}>
              <Tile of={envelopePicture(first)} size={52} />
            </span>
          </span>
          <span className="min-w-0 flex-1">
            {envelopeWords(first, view).from === null ? null : <span className="block text-[13px] font-bold text-text-2">{envelopeWords(first, view).from}</span>}
            <span className="block text-[19px] leading-snug font-bold">{envelopeWords(first, view).words}</span>
          </span>
        </div>
      )}
      {rest.length === 0 ? null : <p className="mt-1 text-[14px] font-bold text-white/85">{say("phone.morning.also")}</p>}
      {rest.map((envelope) => {
        const { from, words } = envelopeWords(envelope, view);
        return (
          <div role="listitem" key={`${envelope.kind}.${envelope.id}`} className="pop flex items-center gap-2.5 rounded-[16px] bg-sheet/95 px-3 py-2 text-left text-[14px] leading-snug text-text shadow-[0_4px_10px_rgba(10,14,30,0.25)]" data-envelope={envelope.id}>
            <span className="sticker-cut shrink-0" style={{ rotate: "4deg" }}>
              <Tile of={envelopePicture(envelope)} size={28} />
            </span>
            <span className="min-w-0 flex-1">
              {from === null ? null : <span className="block text-[12px] font-bold text-text-2">{from}</span>}
              <span className="block font-semibold">{words}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The month's papers that landed or moved, while Papers has not been opened since (world:month-passes-as-lived): each a tap into Papers.
 * A paper a morning notice tells is not told again here.
 */
function PaperNotices({ skip }: { skip: ReadonlySet<string> }) {
  const view = useView();
  const seen = useSeen();
  const nav = use(PhoneNav);
  const mark = papersMarkOf(view);
  const notices = paperNotices(view).filter((notice) => !skip.has(notice.document));
  if (mark === "" || seen.papers === mark || notices.length === 0) return null;
  return (
    <ul className="mt-4 flex flex-col gap-2 px-4" aria-label={say("phone.papers.notices")} data-paper-notices>
      {notices.map((notice) => (
        <li key={`${notice.kind}.${notice.document}`}>
          <button
            type="button"
            onClick={() => nav.openApp("papers")}
            className="phone-notice press pop flex w-full items-center gap-3 px-3 py-2.5 text-left"
            data-paper-notice={`${notice.kind}.${notice.document}`}
          >
            <span className="phone-app-tile flex size-10 shrink-0 items-center justify-center rounded-[12px] text-white" style={{ background: "var(--app-papers)" }} aria-hidden>
              <FolderOpen size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-text-2">{say("phone.app.papers")}</span>
              <span className="block text-[15px] leading-snug font-bold" data-notice-words>{paperNoticeWords(notice, view.month)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Notices() {
  const view = useView();
  const opened = useGame((state) => state.opened);
  const morningShown = useGame((state) => state.morningShown);
  // The opened results are read once as the lock screen shows: they stay on it while it is up, and the store lets them go.
  const [told] = useState(() => opened);
  const done = useRef(false);
  useEffect(() => {
    if (told.length === 0 || done.current) return;
    done.current = true;
    morningShown();
    // Told here, so the paper's own notice and the Papers dot do not tell it again; another paper's notice still waits for Papers.
    const ids = new Set<string>(told.map((envelope) => envelope.id));
    if (paperNotices(view).every((notice) => ids.has(notice.document))) markSeen("papers", papersMarkOf(view));
  }, [told, morningShown, view]);
  const skip = new Set<string>(told.flatMap((envelope) => (envelope.kind === "document" ? [envelope.id] : [])));
  return (
    <>
      <MorningNotices told={told} />
      <PaperNotices skip={skip} />
      <MonthNotices />
    </>
  );
}

function MonthNotices() {
  const view = useView();
  const { due, waiting } = useSignals();
  // Where the character stands is read once as the phone opens: the phone is put away to move.
  const [home] = useState(() => atHome(view));
  const keys = waiting.map((signal) => signal.key).join("|");
  useEffect(() => {
    if (home && keys !== "") tellSignals(keys.split("|"));
  }, [home, keys]);
  if (!home) {
    if (waiting.length === 0) return null;
    return (
      <p className="phone-notice mx-4 mt-4 self-start px-3 py-2 text-[14px] font-semibold" data-phone-away>
        {waiting.length === 1 ? say("ui.days.away.one") : say("ui.days.away.many", { count: waiting.length })}
      </p>
    );
  }
  if (due.length === 0) return null;
  return (
    <ul className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4" aria-label={say("ui.days.notices")} data-phone-notices>
      {[...due].reverse().map((signal) => (
        <li key={signal.key} className="phone-notice pop px-3.5 py-2.5 text-[15px] leading-snug font-semibold" data-notice={signal.key}>
          {say(signal.key)}
        </li>
      ))}
    </ul>
  );
}
