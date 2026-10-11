// Papers (docs/rules/world.md R-WORLD-019; document.md R-DOCUMENT-008): the
// box under the bed on the phone. Every paper the life has or is waiting on, with its state in words, what it counts
// toward, and the act that moves it: a call or a message (the transcript, the council, the assessment) opens its card
// here, the card the box's sheet showed; a visit (the passport office, the test centre) says where and opens the map
// on it. The papers box in the room opens this app. The card is handed in by the shell, so the phone imports no other
// feature.
import type { PlayerView } from "@japacity/sim";
import { ChevronLeft, ChevronRight, FileCheck, FileClock, FilePlus, FileX, MapPin, Stamp, type LucideIcon } from "lucide-react";
import { type ReactNode, use, useEffect, useRef, useState } from "react";

import { useGame, useView } from "../../../authority/GameProvider";
import { PhoneNav } from "../../../shared/phone/nav";
import { nowActOf, nowLineIn, nowLineWords } from "../../../shared/words/acts";
import { monthsLeft, SOON } from "../../../shared/words/expiry";
import { formatBand } from "../../../shared/words/format";
import { sealedTillMorning } from "../../../shared/words/morning";
import { forMonths, inMonths, nameOf, runningName, say, sayCount } from "../../../shared/words/text";
import { PhoneSaid } from "../act";
import { type PaperRow, type PaperState, papersOf } from "../papers";
import { phoneWords } from "../phone.words";

const ENGLISH_RESULT = "document.english-test";

/** The cards of the acts given, from the shell: the same card a thing's sheet shows (R-WORLD-005). */
export type PaperCards = (ids: string[]) => ReactNode;

const ICONS: Readonly<Record<PaperState, LucideIcon>> = { held: FileCheck, coming: FileClock, expired: FileX, "not-yet": FilePlus };
const TONES: Readonly<Record<PaperState, string>> = { held: "text-in", coming: "text-text-2", expired: "text-out", "not-yet": "text-text-2" };

/** The paper's state in words: held and how long, on its way and when, run out, or not yet. */
function stateWords(row: PaperRow, view: PlayerView): string {
  if (row.kind === "visa") {
    const left = view.status?.monthsLeft ?? null;
    return view.status === null ? phoneWords("phone.papers.visa") : left === null ? say("ui.status.no-end") : sayCount("ui.status.months-left", left, { months: left });
  }
  switch (row.state) {
    case "coming":
      // A result sealed until the morning says when it comes (R-CLOCK-032), never "this month".
      if (sealedTillMorning(view, row.id)) return say("ui.wait.morning");
      return phoneWords("phone.papers.pending", { when: inMonths(row.onItsWay ?? view.month, view.month) });
    case "held":
      return row.expiresMonth === null ? say("ui.document.held") : phoneWords("phone.papers.valid", { when: forMonths(row.expiresMonth, view.month) });
    case "expired":
      return say("ui.document.expired");
    case "not-yet":
      return phoneWords("phone.papers.not-yet");
    default: {
      const never: never = row.state;
      return never;
    }
  }
}

/** "Counts toward a master's in the UK", the plan's way first, at most two named. */
function countsWords(counts: readonly string[]): string | null {
  const [first, second] = counts;
  if (first === undefined) return null;
  const routes = second === undefined ? runningName(first) : phoneWords("phone.papers.for.and", { first: runningName(first), last: runningName(second) });
  return phoneWords("phone.papers.for", { routes });
}

function Paper({ row, view, onCard }: { row: PaperRow; view: PlayerView; onCard: (activity: string) => void }) {
  const nav = use(PhoneNav);
  const paper = view.documents.find((held) => held.id === row.id);
  const left = paper === undefined ? null : monthsLeft(paper, view.month);
  const Icon = row.kind === "visa" ? Stamp : ICONS[row.state];
  const counts = countsWords(row.counts);
  const act = row.act;
  return (
    <li data-paper={row.id} data-state={row.state} data-kind={row.kind} className="flex flex-col gap-2 rounded-[6px] p-3" style={{ background: "var(--paper-bill)" }}>
      <div className="flex items-start gap-3">
        <Icon size={20} aria-hidden className={`mt-0.5 shrink-0 ${row.kind === "visa" ? "text-in" : TONES[row.state]}`} />
        <div className="min-w-0 flex-1">
          <p className={`text-[15px] font-bold ${row.state === "expired" ? "line-through" : ""}`}>{nameOf(row.id)}</p>
          <p className="text-[13px] text-text-2" data-paper-state>
            {stateWords(row, view)}
          </p>
          {left !== null && left <= SOON ? <p className="text-[13px] font-bold text-out">{sayCount("ui.document.expires-soon", left, { months: left })}</p> : null}
          {row.id === ENGLISH_RESULT && row.value !== null ? <p className="text-[13px] font-bold">{say("ui.document.band", { band: formatBand(row.value) })}</p> : null}
          {counts === null ? null : (
            <p className="text-[12px] text-text-2" data-paper-counts>
              {counts}
            </p>
          )}
        </div>
      </div>
      {act === null ? null : act.how === "phone" ? (
        <button type="button" onClick={() => onCard(act.activity)} className="press flex min-h-11 w-full items-center gap-2 rounded-[5px] border border-sheet-line bg-sheet-2 px-3 text-left text-[14px] font-bold" data-paper-act={act.activity} data-act-how="phone">
          <span className="min-w-0 flex-1 truncate">{nameOf(act.activity)}</span>
          <ChevronRight size={16} className="shrink-0 text-text-2" aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (act.place !== null) nav.openMap?.(act.place);
          }}
          className="press flex min-h-11 w-full items-center gap-2 rounded-[5px] border border-sheet-line bg-sheet-2 px-3 text-left text-[14px] font-bold"
          data-paper-act={act.activity}
          data-act-how="visit"
          data-act-place={act.place ?? ""}
        >
          <MapPin size={16} className="shrink-0 text-text-2" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{phoneWords("phone.papers.at", { place: act.place === null ? "" : say(`${act.place}.name`) })}</span>
          <ChevronRight size={16} className="shrink-0 text-text-2" aria-hidden />
        </button>
      )}
    </li>
  );
}

/** `opening`: an act whose card opens at once, as the nudge's step asks (R-WORLD-003). `cards`: the shell's card for an act. */
export function Papers({ opening = null, cards = null }: { opening?: string | null; cards?: PaperCards | null }) {
  const view = useView();
  const said = use(PhoneSaid);
  const rows = papersOf(view);
  const offered = (activity: string | null): boolean => activity !== null && view.activities.some((option) => option.id === activity && option.allowed);
  const [card, setCard] = useState<string | null>(() => (cards !== null && offered(opening) ? opening : null));
  // An act done at once from its card is answered on the phone, in the corner, and the card closes (R-ACTIVITY-015, R-WORLD-026).
  const lines = useGame((state) => state.lines);
  const seen = useRef(lines);
  useEffect(() => {
    if (seen.current === lines) return;
    seen.current = lines;
    const line = nowLineIn(lines);
    if (card === null || line === null || nowActOf(line) !== card) return;
    said(nowLineWords(line));
    setCard(null);
  }, [lines, card, said]);
  if (card !== null && cards !== null) {
    return (
      <div data-phone-app="papers" data-paper-card={card}>
        <button type="button" onClick={() => setCard(null)} className="press mb-2 flex items-center gap-1 text-[14px] font-bold text-text-2" data-papers-back>
          <ChevronLeft size={16} aria-hidden />
          {phoneWords("phone.papers.back")}
        </button>
        {cards([card])}
      </div>
    );
  }
  return (
    <div data-phone-app="papers" data-papers>
      <h3 className="title text-[18px]">{phoneWords("phone.papers.title")}</h3>
      <p className="mt-1 mb-3 text-[13px] text-text-2">{phoneWords("phone.papers.hint")}</p>
      {rows.length === 0 ? (
        <p className="text-[14px] text-text-2" data-papers-none>
          {phoneWords("phone.papers.none")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <Paper key={row.id} row={row} view={view} onCard={cards === null ? () => undefined : setCard} />
          ))}
        </ul>
      )}
    </div>
  );
}
