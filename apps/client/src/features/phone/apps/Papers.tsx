// Papers (world:phone-holds-what-phones-hold; document:paper-on-its-way): the
// box under the bed on the phone. Every paper the life has or is waiting on, with its state in words, what it counts
// toward, and the act that moves it: a call or a message (the transcript, the council, the assessment) opens its card
// here, the card the box's sheet showed; a visit (the passport office, the test centre) says where and opens the map
// on it. Under the papers, abroad, the status held and the renewal; where the life is, the fare home and the times it
// came home; and the person as content names them (PapersMore.tsx). The papers box in the room opens this app. The card
// is handed in by the shell, so the phone imports no other feature.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { ChevronLeft, ChevronRight, MapPin, Send } from "lucide-react";
import { type ReactNode, use, useEffect, useRef, useState } from "react";

import { useGame, useView } from "../../../authority/GameProvider";
import { PhoneNav } from "../../../shared/phone/nav";
import { nowActOf, nowLineIn, nowLineWords } from "../../../shared/words/acts";
import { monthsLeft, SOON } from "../../../shared/words/expiry";
import { formatBand, formatMoney } from "../../../shared/words/format";
import { overstayWords } from "../../../shared/words/overstay";
import { sealedTillMorning } from "../../../shared/words/morning";
import { forMonths, inMonths, nameOf, runningName, say, sayCount, words } from "../../../shared/words/text";
import { PhoneSaid } from "../act";
import { degreeEnglishOf, type PaperRow, papersOf } from "../papers";
import { GhostButton, PicCard, PicTile, WordChip } from "../ui";
import { PapersPlace, PapersStatus, PapersYou } from "./PapersMore";

const ENGLISH_RESULT = "document.english-test";

/** The cards of the acts given, from the shell: the same card a thing's sheet shows (world:things-are-tappable-models). */
export type PaperCards = (ids: string[]) => ReactNode;


/** The paper's state in words: held and how long, on its way and when, run out, or not yet. */
function stateWords(row: PaperRow, view: PlayerView): string {
  if (row.kind === "visa") {
    // An overstay has no end date: its stage is what the row says (status:view-shows-status).
    const overstay = overstayWords(view);
    if (overstay !== null) return overstay.title;
    const left = view.status?.monthsLeft ?? null;
    return view.status === null ? say("phone.papers.visa") : left === null ? say("ui.status.no-end") : sayCount("ui.status.months-left", left, { months: left });
  }
  switch (row.state) {
    case "coming":
      // A result sealed until the morning says when it comes (clock:envelopes-show-real-waits), never "this month".
      if (sealedTillMorning(view, row.id)) return say("ui.wait.morning");
      return say("phone.papers.pending", { when: inMonths(row.onItsWay ?? view.month, view.month) });
    case "held":
      return row.expiresMonth === null ? say("ui.document.held") : say("phone.papers.valid", { when: forMonths(row.expiresMonth, view.month) });
    case "expired":
      return say("ui.document.expired");
    case "not-yet":
      return say("phone.papers.not-yet");
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
  const routes = second === undefined ? runningName(first) : say("phone.papers.for.and", { first: runningName(first), last: runningName(second) });
  return say("phone.papers.for", { routes });
}

/**
 * What a paper not yet asked for costs and how long it takes, for one asked on the phone with a fixed wait: "₦150,000. It comes
 * in a month." (document:degree-english-statement). Null for any other.
 */
function costsWords(row: PaperRow): string | null {
  const act = row.act;
  if (row.state !== "not-yet" || act === null || act.how !== "phone") return null;
  const entry = content.activity[act.activity as keyof typeof content.activity];
  const paper = content.document[row.id as keyof typeof content.document];
  const naira = (entry?.cost ?? []).reduce((sum, cost) => sum + (cost.currency === "NGN" && typeof cost.amount === "number" ? cost.amount : 0), 0);
  // document:trade-papers: exams of several sittings are paid a sitting at a time, every so many months of study.
  const sittings = entry?.exam?.sittings ?? 1;
  if (sittings > 1 && naira > 0) return say("phone.papers.sittings", { fee: formatMoney(naira, "NGN"), count: sittings, months: entry?.onMonth?.[0]?.at ?? 0 });
  if (paper === undefined || naira === 0 || paper.wait[0] !== paper.wait[1]) return null;
  const months = paper.wait[0];
  return sayCount("phone.papers.costs", months, { fee: formatMoney(naira, "NGN"), months });
}

/**
 * What a paper opens beside the ways out (document:trade-papers, route-gates:family-gift-counts-with-deed): "A senior teacher's post asks for it",
 * or the paper's own words where it opens money a way counts. Null for any other.
 */
function opensWords(row: PaperRow): string | null {
  if (row.opens === undefined || row.state === "held") return null;
  return row.opens === row.id ? say(`phone.papers.opens.${row.id}`) : say("phone.papers.opens", { job: nameOf(row.opens) });
}

/** The plan's English when it is the degree and no paper (route:degree-meets-masters-english): the degree stands in the box as the English. */
function DegreeEnglish({ view }: { view: PlayerView }) {
  const degree = degreeEnglishOf(view);
  if (degree === null) return null;
  return (
    <li data-paper-degree={degree.route}>
      <PicCard
        pic="activity.degree-english"
        tint={degree.met ? "money" : "study"}
        title={words(`${degree.route}.item.english`)}
        chips={<WordChip tone={degree.met ? "soft" : "study"}>{say(degree.met ? "ui.document.held" : "phone.papers.not-yet")}</WordChip>}
      />
    </li>
  );
}

function Paper({ row, view, onCard }: { row: PaperRow; view: PlayerView; onCard: (activity: string) => void }) {
  const nav = use(PhoneNav);
  const paper = view.documents.find((held) => held.id === row.id);
  const left = paper === undefined ? null : monthsLeft(paper, view.month);
  const counts = countsWords(row.counts);
  const costs = costsWords(row);
  const opens = opensWords(row);
  const act = row.act;
  const tone = row.kind === "visa" || row.state === "held" ? "held" : row.state;
  return (
    <li data-paper={row.id} data-state={row.state} data-kind={row.kind}>
      <PicCard
        pic={row.kind === "visa" ? "place.visa-centre" : row.id}
        tint={tone === "held" ? "money" : tone === "expired" ? "food" : "study"}
        muted={row.state === "expired"}
        title={<span className={row.state === "expired" ? "line-through" : ""}>{nameOf(row.id)}</span>}
        chips={
          <>
            <span
              className={`sticker-chip text-[13px] chip-wrap ${tone === "held" ? "bg-tint-money" : tone === "coming" ? "bg-[var(--soft)]" : tone === "expired" ? "bg-sheet-2" : "bg-tint-study"}`}
              style={{ rotate: "-1.5deg", color: tone === "held" ? "var(--money-ink)" : tone === "coming" ? "var(--soft-ink)" : tone === "expired" ? "var(--out)" : undefined }}
              data-paper-state
            >
              {stateWords(row, view)}
            </span>
            {left !== null && left <= SOON ? <WordChip tone="bad">{sayCount("ui.document.expires-soon", left, { months: left })}</WordChip> : null}
            {row.id === ENGLISH_RESULT && row.value !== null ? <WordChip tone="study">{say("ui.document.band", { band: formatBand(row.value) })}</WordChip> : null}
            {counts === null ? null : (
              <span className="text-[13px] text-text-2" data-paper-counts>
                {counts}
              </span>
            )}
            {opens === null ? null : (
              <span className="text-[13px] text-text-2" data-paper-opens>
                {opens}
              </span>
            )}
            {costs === null ? null : (
              <span className="num text-[13px] text-text-2" data-paper-costs>
                {costs}
              </span>
            )}
          </>
        }
        foot={
          act === null ? null : act.how === "phone" ? (
            <GhostButton wide onClick={() => onCard(act.activity)} className="text-left" data-paper-act={act.activity} data-act-how="phone">
              <Send size={18} className="shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 py-2.5 leading-snug" data-paper-act-words>{nameOf(act.activity)}</span>
              <ChevronRight size={18} className="shrink-0" aria-hidden />
            </GhostButton>
          ) : (
            <GhostButton wide
              onClick={() => {
                if (act.place !== null) nav.openMap?.(act.place);
              }}
              className="text-left"
              data-paper-act={act.activity}
              data-act-how="visit"
              data-act-place={act.place ?? ""}
            >
              <MapPin size={18} className="shrink-0" aria-hidden />
              {/* The place's words wrap and the button grows, never cut short as "At the English test ce...". */}
              <span className="min-w-0 flex-1 py-2.5 leading-snug" data-paper-act-words>{say("phone.papers.at", { place: act.place === null ? "" : say(`${act.place}.name`) })}</span>
              <ChevronRight size={18} className="shrink-0" aria-hidden />
            </GhostButton>
          )
        }
      />
    </li>
  );
}

/** `opening`: an act whose card opens at once, as the nudge's step asks (world:nudge-says-one-thing). `cards`: the shell's card for an act. */
export function Papers({ opening = null, cards = null }: { opening?: string | null; cards?: PaperCards | null }) {
  const view = useView();
  const said = use(PhoneSaid);
  const rows = papersOf(view);
  const offered = (activity: string | null): boolean => activity !== null && view.activities.some((option) => option.id === activity && option.allowed);
  const [card, setCard] = useState<string | null>(() => (cards !== null && offered(opening) ? opening : null));
  // An act done at once from its card is answered on the phone, in the corner, and the card closes (activity:now-acts-and-month-acts, world:street-talk-budget).
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
          {say("phone.papers.back")}
        </button>
        {cards([card])}
      </div>
    );
  }
  return (
    <div data-phone-app="papers" data-papers>
      {/* The box under the bed: the box, its title and the line under it; then
          each paper a card with its picture, its state as a chip, what it counts toward, and its act beneath. */}
      <div className="mb-3 flex items-center gap-3 px-0.5">
        <PicTile of="thing.papers-box" size={56} tint="plain" tilt={-8} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[19px] leading-tight font-bold">{say("phone.papers.title")}</h3>
          <p className="mt-0.5 text-[14px] leading-snug text-text-2">{say("phone.papers.hint")}</p>
        </div>
      </div>
      {rows.length === 0 && degreeEnglishOf(view) === null ? (
        <p className="px-0.5 text-[15px] text-text-2" data-papers-none>
          {say("phone.papers.none")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <Paper key={row.id} row={row} view={view} onCard={cards === null ? () => undefined : setCard} />
          ))}
          <DegreeEnglish view={view} />
        </ul>
      )}
      {/* The status held abroad, where the life is and the times it came home, and the person as content names them. */}
      <PapersStatus />
      <PapersPlace />
      <PapersYou />
    </div>
  );
}
