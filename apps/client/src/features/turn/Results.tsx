// The month's results (world:month-end-results-sheet). The staged wins (Moment) come first; the sheet
// opens once they have passed. It leads with the money (payday when there is one, the rent when it was due, Kept, the
// savings bar), then the people asked of the player as faces, then the month's events that changed what the player holds;
// what was bought by hand during the month was paid as it was done and is not listed again, and the rest of the month lives
// in News. `foot`: a line another feature puts under the results, placed by the shell. `onAsk`: opens an ask's card, by the
// shell, once the results are put away.
import { ChevronRight } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import type { PlayerView, ReportLine } from "@japacity/sim";
import { qualityIn } from "@japacity/sim";

import { useGame, useView } from "../../authority/GameProvider";
import { cue } from "../../shared/sound/cues";
import { StateTag } from "../../shared/ui/StateTag";
import { Counter } from "../../shared/world/TopBand";
import { WorldSheet } from "../../shared/world/WorldSheet";
import { Tile } from "../../shared/tiles/Tile";
import { PressButton } from "../../shared/ui/look/PressButton";
import { formatMoney, formatNumber } from "../../shared/words/format";
import { nowLineWords } from "../../shared/words/acts";
import { askerOf } from "../../shared/words/asks";
import { hasWords, inMonths, nameOf, runningName, say, sayCount, words } from "../../shared/words/text";
import { faceMark } from "../../shared/ui/look/Face";
import { ToneTag } from "../../shared/ui/ToneTag";
import { CHANGED_INTO, changesInto, drawMissed, drawShown, isEvicted, isUnpaid, kept, leadsAlone, type MoneyLine, monthClose, moneyLines, monthTags, runningOut, savings, toldOnResults } from "./month.results";
import { turnWords } from "./turn.words";
import { localCurrency } from "../../shared/words/wayHome";

/** True while the results sheet is up: the month has just ended and its staged wins have passed. */
function useResultsOpen(): boolean {
  const open = useGame((state) => state.reportOpen && state.moments.length === 0);
  const report = useView().report;
  return open && report !== null;
}

function signed(sign: number, amount: number, currency: Parameters<typeof formatMoney>[1]): string {
  return `${sign < 0 ? "-" : "+"}${formatMoney(Math.abs(amount), currency)}`;
}

/** The adviser's reading: the route in her words, then its conditions as tags (advice:licensed-adviser-is-truthful, text:show-then-tell). */
const READING_MISSING = "line.activity.adviser-missing";
const READING_FITS = "line.activity.adviser-fits";

function Reading({ line }: { line: ReportLine }) {
  const { count, months } = line.params;
  return (
    <span className="flex flex-col gap-1.5" data-reading={line.key === READING_FITS ? "fits" : "missing"}>
      <span>{words("ui.results.reading", { route: line.params.route ?? "" })}</span>
      <span className="flex flex-wrap gap-1.5">
        {line.key === READING_FITS ? (
          <StateTag state="done" id="fits">
            {say("ui.results.reading.fits")}
          </StateTag>
        ) : (
          <>
            {typeof count === "number" ? (
              <StateTag state="failed" id="missing">
                {say("ui.results.reading.missing", { count })}
              </StateTag>
            ) : null}
            {typeof months === "number" ? (
              <StateTag state="waiting" id="months">
                {sayCount("ui.results.reading.months", months, { count: months })}
              </StateTag>
            ) : null}
          </>
        )}
      </span>
    </span>
  );
}

/** The line that says a new offer waits; stale once the offer has been answered within the month. */
const OFFER_OPENED = "line.offer.opened";

/** `place`: the name of where the player is, which the one main button returns them to. */
export function Results({ place, foot = null, onAsk }: { place: string; foot?: ReactNode; onAsk?: (offer: string) => void }) {
  const view = useView();
  const shown = useResultsOpen();
  const setReportOpen = useGame((state) => state.setReportOpen);
  const report = view.report;
  // world:top-band-is-a-pill: no month number; the character's age stands small beside what was kept, and a birthday is said.
  const ageMonths = qualityIn(view, "quality.age-months");
  const clock = say("ui.world.age", { years: Math.floor(ageMonths / 12), months: ageMonths % 12 });
  const birthday = ageMonths > 0 && ageMonths % 12 === 0;
  const midMonth = useGame((state) => state.lastMonthLines);
  const local = localCurrency(view);
  const lines = report === null ? [] : moneyLines([...midMonth, ...report.lines]);
  const nets = kept(lines);
  const main = nets.find((net) => net.currency === local) ?? nets[0] ?? { currency: local, amount: 0 };
  const rest = nets.filter((net) => net !== main);
  const tags = monthTags(lines);
  const changes = changesInto(lines);
  // The counter counts up from nothing each time the sheet opens.
  const [counted, setCounted] = useState(0);
  useEffect(() => {
    setCounted(shown ? main.amount : 0);
    if (shown) cue("month");
  }, [shown, main.amount]);
  if (report === null) return null;
  const draw = drawShown(view);
  const missed = drawMissed(view, [...midMonth, ...report.lines]);
  const save = savings(view);
  // An offer that opened and was answered within the month (asked around, then walked on) needs no answer now.
  const told = [...midMonth, ...report.lines].filter((line) => !(line.key === OFFER_OPENED && typeof line.params["offer"] === "string" && !view.offers.some((offer) => offer.entry === line.params["offer"])));
  const close = monthClose(told, report.lines);
  const story = close.moments;
  const expiring = runningOut(view);
  const back = (): void => {
    cue("close");
    setReportOpen(false);
  };
  // The people asked of the player, the soonest due first, as the asks sheet orders them.
  const asked = [...view.offers].sort((a, b) => a.expiresMonth - b.expiresMonth);
  const ask = (offer: string): void => {
    back();
    onAsk?.(offer);
  };
  // Nothing told but the money: no face, no event, no draw and no paper running out.
  const quiet = asked.length === 0 && story.length === 0 && draw === null && expiring.length === 0;
  // The visa's answer and the room on the water cleared away stand first and alone, before the money.
  const bigNews = story.some((line) => leadsAlone(line) || isEvicted(line));
  const storySection =
    story.length === 0 ? null : (
      <section className="flex flex-col gap-1" aria-label={turnWords("turn.results.story")} data-results-story>
        {/* The best thing first with its picture, when payday has not led: a good
            moment or the grant; then two more as rows with a picture each, the rest behind "See the whole month". */}
        <h3 className="text-[14px] font-bold text-text-2">{turnWords("turn.results.story")}</h3>
        <ul className="flex flex-col gap-1.5">
          {story.slice(0, SHOWN_MOMENTS).map((line, index) => (
            <StoryRow key={`${line.key}-${String(index)}`} line={line} hero={index === 0 && (close.payday.length === 0 || leadsAlone(line)) && (line.tone === "good" || leadsAlone(line))} />
          ))}
        </ul>
        {story.length <= SHOWN_MOMENTS ? null : (
          <details className="results-more" data-results-more>
            <summary className="press mx-auto mt-1 w-max cursor-pointer list-none text-[16px] font-bold underline decoration-2 underline-offset-4">{say("ui.results.whole-month")}</summary>
            <ul className="mt-2 flex flex-col gap-1.5">
              {story.slice(SHOWN_MOMENTS).map((line, index) => (
                <StoryRow key={`${line.key}-more-${String(index)}`} line={line} hero={false} />
              ))}
            </ul>
          </details>
        )}
      </section>
    );

  return (
    <WorldSheet
      open={shown}
      onClose={back}
      label={clock}
      title={turnWords("turn.results.title")}
      mark="results"
      foot={
        <PressButton className="w-full" onClick={back} data-results-back>
          <span className="truncate">{turnWords("turn.results.back", { place })}</span>
        </PressButton>
      }
    >
      <div className="flex flex-col gap-4">
        {birthday ? <p className="text-[14px] font-bold text-strong" data-results-birthday>{turnWords("turn.results.birthday", { years: Math.floor(ageMonths / 12) })}</p> : null}
        {/* Payday leads, then the rent when it was due: the month's turn in money, each its own line,
            unless the month's news is the visa's answer or the room on the water cleared away, which lead before any money. */}
        {bigNews ? storySection : null}
        {close.payday.map((entry, index) => (
          <MoneyRow key={`payday-${String(index)}`} entry={entry} mark="payday" />
        ))}
        {close.rent.map((entry, index) => (
          <MoneyRow key={`rent-${String(index)}`} entry={entry} mark="rent" />
        ))}

        {lines.length === 0 ? (
          // No money moved: said in words of money, never "+₦0", and only when the sheet has nothing else to tell; with a face,
          // an event, the draw or a paper running out, the sheet leads with that (world:month-end-results-sheet).
          quiet ? (
            <div className="flex items-baseline justify-between gap-3" data-results-kept={0}>
              <span className="text-[16px] leading-none font-semibold text-text-2">{turnWords("turn.results.nothing-moved")}</span>
            </div>
          ) : null
        ) : (
          // Losses are never the loudest: a month down is said quietly, a month up in green.
          <div className="flex items-baseline justify-between gap-3" data-results-kept={main.amount}>
            <span className="text-[14px] font-semibold text-text-2">{turnWords(main.amount < 0 ? "turn.results.lost" : "turn.results.kept")}</span>
            <Counter value={counted} format={(value) => signed(value, value, main.currency)} className={main.amount < 0 ? "text-[16px] leading-none text-text-2" : "text-[24px] leading-none text-in"} />
          </div>
        )}
        {rest.map((net) => (
          <div key={net.currency} className="-mt-3 flex justify-end">
            <span className={`num text-[15px] ${net.amount < 0 ? "text-out" : "text-in"}`}>{signed(net.amount, net.amount, net.currency)}</span>
          </div>
        ))}
        {/* Each change of money, both sides as they were: it counts for nothing in Kept, so it is said here (world:month-end-results-sheet). */}
        {changes.length === 0 ? null : (
          <ul className="-mt-2 flex flex-col items-end gap-0.5" data-results-changes>
            {changes.map((change, index) => (
              <li key={index} className="text-right text-[13px] leading-snug text-text-2" data-results-change>
                {say(CHANGED_INTO, { paid: change.paid, got: change.got })}
              </li>
            ))}
          </ul>
        )}
        {tags.length === 0 ? null : (
          <div className="-mt-2 flex flex-wrap justify-end gap-1.5" data-results-tags>
            {tags.map((tag) => (
              <span key={`${tag.id}-${tag.amount.currency}`} className="contents" data-results-tag={tag.id}>
                <ToneTag tone={tag.tone}>{say(tag.key, { amount: tag.amount })}</ToneTag>
              </span>
            ))}
          </div>
        )}

        {save === null ? null : (
          <section className="flex flex-col gap-1.5" data-results-savings>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="label text-text-2">{turnWords(save.kind === "funds" ? "turn.results.savings" : "turn.results.ready")}</h3>
              <span className="num text-[14px]">
                {save.kind === "funds" ? turnWords("turn.results.savings-line", { shown: formatMoney(save.shown, save.currency), required: formatMoney(save.required, save.currency) }) : `${String(save.percent)}%`}
              </span>
            </div>
            <Bar value={save.kind === "funds" ? save.shown : save.percent} max={save.kind === "funds" ? save.required : 100} label={turnWords(save.kind === "funds" ? "turn.results.savings" : "turn.results.ready")} />
          </section>
        )}

        {asked.length === 0 ? null : (
          <section className="flex flex-col gap-1.5" aria-label={turnWords("turn.results.asked")} data-results-asked>
            {/* The people asked of the player: a face each, the asker's mark and name and the ask's own title; a tap opens its card. */}
            <h3 className="text-[14px] font-bold text-text-2">{turnWords("turn.results.asked")}</h3>
            <ul className="flex flex-col gap-1.5">
              {asked.map((offer) => (
                <li key={offer.id}>
                  <button type="button" className="press reach flex min-h-[48px] w-full items-center gap-3 py-1 text-left" onClick={() => ask(offer.id)} data-results-ask={offer.id}>
                    <AskFace name={askerOf(offer)} />
                    <span className="min-w-0 flex-1">
                      {/* The words wrap rather than cut: a name or a job never loses its end (world:reach-and-read). */}
                      <span className="block text-[13px] leading-snug font-semibold text-text-2">{askerOf(offer)}</span>
                      <span className="block text-[15px] leading-snug font-bold">{askWords(offer)}</span>
                      {/* wallet:view-carries-month-pay: an offer of work keeps the figure the player decides on. */}
                      {offer.pay === undefined || typeof offer.terms["job"] !== "string" ? null : (
                        <span className="num block text-[13px] text-text-2" data-results-ask-pay>
                          {turnWords("turn.results.asked.pay", { amount: formatMoney(offer.pay.amount, offer.pay.currency) })}
                        </span>
                      )}
                    </span>
                    <ChevronRight size={18} aria-hidden className="shrink-0 text-text-2" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {bigNews ? null : storySection}

        {/* A paper the plan needs that runs out within two months, the application not sent: one line each. */}
        {expiring.map((paper) => (
          <p key={paper.document} className="text-[14px] font-bold text-out" data-results-runs-out={paper.document}>
            {say("document.reminder.runs-out", { document: runningName(paper.document), when: inMonths(paper.expiresMonth, view.month) })}
          </p>
        ))}

        {draw === null ? null : (
          <section className="flex flex-col gap-1.5" data-results-draw={draw.draw}>
            <h3 className="label text-text-2">{turnWords("turn.results.draw", { draw: draw.draw })}</h3>
            <ul className="flex flex-wrap gap-1.5">
              {draw.numbers.map((number) => {
                const lit = draw.matched.includes(number);
                return (
                  <li key={number} className={`num pop rounded-[4px] px-2 py-1 text-[14px] ${lit ? "bg-signal text-action-text" : "bg-sheet-muted text-text"}`} data-matched={lit}>
                    {formatNumber(number)}
                  </li>
                );
              })}
            </ul>
            {draw.matched.length > 0 ? <p className="text-[13px] font-semibold">{turnWords("turn.results.draw-matched")}</p> : null}
            {missed === null ? null : (
              <p className="text-[13px] font-semibold" data-results-draw-missed={missed}>
                {turnWords(missed === 1 ? "turn.results.draw-missed.one" : "turn.results.draw-missed")}
              </p>
            )}
          </section>
        )}

        {foot}
      </div>
    </WorldSheet>
  );
}

/** The asker's face: the round mark with their initial in the colour their name gives them, as every face in the game has. */
function AskFace({ name }: { name: string }) {
  const mark = faceMark(name);
  return (
    <span className="face-mark flex size-10 shrink-0 items-center justify-center text-[17px] font-bold text-white" style={{ background: mark.colour }} aria-hidden="true" data-face-mark>
      {mark.initial}
    </span>
  );
}

/** A face's words: the job an offer of work names, else the ask's own title in the asker's voice. */
function askWords(offer: PlayerView["offers"][number]): string {
  const job = offer.terms["job"];
  return typeof job === "string" ? nameOf(job) : say(`${offer.entry}.title`);
}

/** How many of the month's moments stand before "See the whole month". */
const SHOWN_MOMENTS = 3;

/** A moment's picture by what it is, since the kinds of line have no tiles of their own. */
function momentPicture(key: string): string {
  if (key.startsWith("line.route.granted") || key.includes("granted") || key === "line.route.switched") return "🛂";
  if (key.startsWith("line.offer")) return "📨";
  if (key.startsWith("line.news")) return "📻";
  if (key.startsWith("line.job") || key.startsWith("line.activity.job")) return "💼";
  if (key.startsWith("line.document")) return "📄";
  if (key.startsWith("line.people")) return "💬";
  if (key.startsWith("line.obligation")) return "🧾";
  if (key.startsWith("line.lottery") || key.startsWith("line.luck")) return "🎟️";
  return "✨";
}

/** One moment of the month: a picture and its words; the best one leads as a card with a larger picture. */
function StoryRow({ line, hero }: { line: ReportLine; hero: boolean }) {
  const view = useView();
  const told = toldOnResults(line, view);
  // home:makoko-eviction-draw: the room cleared away is told in the same red as a bill unpaid.
  const unpaid = isUnpaid(line) || isEvicted(line);
  const lead = leadsAlone(line);
  const tone = lead ? "text-[18px] leading-tight font-bold" : unpaid ? "text-[15px] leading-snug font-semibold text-out" : "text-[15px] leading-snug";
  return (
    <li className={`flex items-center gap-3 ${hero ? "look-card p-3" : "py-1"} ${tone}`} data-story-line={line.key} data-tone={line.tone} data-unpaid={unpaid ? "true" : undefined} data-story-lead={lead ? "true" : undefined} {...(hero ? { "data-results-best": "" } : {})}>
      <span className={`flex shrink-0 items-center justify-center rounded-[14px] bg-tint-plain ${hero ? "size-16 text-[34px]" : "size-10 text-[22px]"}`} aria-hidden>
        {/* The picture is drawn from its attribute, so the line's words stay the row's only text. */}
        <span className="sticker-cut drawn-pic" style={{ rotate: "-5deg" }} data-pic={momentPicture(line.key)} />
      </span>
      <span className="min-w-0 flex-1">{line.key === READING_MISSING || line.key === READING_FITS ? <Reading line={line} /> : words(told.key, told.params)}</span>
    </li>
  );
}

/**
 * What a line of money is, as its label beside the figure (world:month-end-results-sheet): "Salary, junior developer", "Rent", never the
 * line's sentence with the amount in it, since the figure says the amount once.
 */
function moneyLabel(line: ReportLine): string {
  return hasWords(`${line.key}.label`) ? words(`${line.key}.label`, line.params) : nowLineWords(line);
}

/**
 * A line of the month's turn in money, as the close leads with it: payday as the best thing first, a card with the job's
 * picture and the figure in green; the rent as a sticker chip, out, never louder than what came in.
 */
function MoneyRow({ entry, mark }: { entry: MoneyLine; mark: "payday" | "rent" }) {
  const { line, sign, amount, currency } = entry;
  const view = useView();
  if (mark === "payday") {
    return (
      <div className="look-card flex items-center gap-3 p-3" data-results-payday={amount} data-results-best data-sign={sign}>
        <span className="flex size-16 shrink-0 items-center justify-center rounded-[14px] bg-tint-money">
          <span className="sticker-cut" style={{ rotate: "-5deg" }}>
            {view.job.id === null ? <span className="drawn-pic text-[34px]" data-pic="💰" /> : <Tile of={view.job.id} size={46} />}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] leading-snug font-semibold" data-results-money-label>{moneyLabel(line)}</span>
          <span className={`num block text-[22px] ${sign < 0 ? "text-out" : "text-in"}`}>{signed(sign, amount, currency)}</span>
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2" data-results-rent={amount} data-sign={sign}>
      <span className="sticker-chip bg-sheet-2 text-[14px]" style={{ rotate: "-1deg" }}>
        <span className="drawn-pic" data-pic="🏠" aria-hidden />
        <span data-results-money-label>{moneyLabel(line)}</span>
        <span className={`num ${sign < 0 ? "text-text-2" : "text-in"}`}>{signed(sign, amount, currency)}</span>
      </span>
    </div>
  );
}

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const share = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)} className="h-2.5 w-full overflow-hidden rounded-[2px] bg-sheet-muted">
      <div className="h-full rounded-[2px] bg-ink transition-[width] duration-450" style={{ width: `${String(share * 100)}%` }} />
    </div>
  );
}
