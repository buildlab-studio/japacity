// The month's results (docs/rules/world.md R-WORLD-008): when a month ends, one sheet over the scene
// says what was kept as a counter, then the month's story (an offer, a way out, a paper, a test band,
// a chapter), every line in or out with its sign, the draw's numbers with any of the player's lit,
// the savings toward the move, then one button back to the place. The staged wins (Moment) come
// first; the sheet opens once they have passed. The month's other lines are not listed here: they
// live in the phone's News app.
import { useEffect, useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { cue } from "../../shared/sound/cues";
import { Counter } from "../../shared/world/Band";
import { WorldSheet } from "../../shared/world/WorldSheet";
import { formatMoney, formatNumber } from "../../shared/words/format";
import { say, words } from "../../shared/words/text";
import { drawShown, isUnpaid, kept, leadsAlone, localCurrency, moneyLines, quietLine, savings, storyLines, toldOnResults, untoldLines } from "./month.results";
import { turnWords } from "./turn.words";

/** True while the results sheet is up: the month has just ended and its staged wins have passed. */
export function useResultsOpen(): boolean {
  const open = useGame((state) => state.reportOpen && state.moments.length === 0);
  const report = useView().report;
  return open && report !== null;
}

function signed(sign: number, amount: number, currency: Parameters<typeof formatMoney>[1]): string {
  return `${sign < 0 ? "-" : "+"}${formatMoney(Math.abs(amount), currency)}`;
}

/** A quiet month of an Until news run in its one line (R-WORLD-028): "Kept ₦96,000. Nothing else moved." */
function quietWords(lines: Parameters<typeof quietLine>[0], currency: Parameters<typeof quietLine>[1]): string {
  const { kept: net, moved } = quietLine(lines, currency);
  const money = net === null ? null : turnWords(net < 0 ? "turn.results.quiet-down" : "turn.results.quiet-kept", { amount: formatMoney(Math.abs(net), currency) });
  const rest = moved === null ? turnWords(money === null ? "turn.results.quiet-none" : "turn.results.quiet-still") : words(moved.key, moved.params);
  return money === null ? rest : `${money} ${rest}`;
}

/** The chapter closed this month: its line says the months are full again (R-WORLD-027, R-TURN-004). */
const CHAPTER_CLOSED = "line.chapter.closed";

/** `place`: the name of where the player is, which the one main button returns them to. */
export function Results({ place }: { place: string }) {
  const view = useView();
  const shown = useResultsOpen();
  const setReportOpen = useGame((state) => state.setReportOpen);
  const report = view.report;
  // R-WORLD-002: no month number; the character's age stands small beside what was kept, and a birthday is said.
  const ageMonths = view.qualities.find((quality) => quality.id === "quality.age-months")?.value ?? 0;
  const clock = say("ui.world.age", { years: Math.floor(ageMonths / 12), months: ageMonths % 12 });
  const birthday = ageMonths > 0 && ageMonths % 12 === 0;
  const midMonth = useGame((state) => state.lastMonthLines);
  const quiet = useGame((state) => state.quiet);
  const local = localCurrency(view);
  const lines = report === null ? [] : moneyLines([...midMonth, ...report.lines], local);
  const nets = kept(lines);
  const main = nets.find((net) => net.currency === local) ?? nets[0] ?? { currency: local, amount: 0 };
  const rest = nets.filter((net) => net !== main);
  // The counter counts up from nothing each time the sheet opens.
  const [counted, setCounted] = useState(0);
  useEffect(() => {
    setCounted(shown ? main.amount : 0);
    if (shown) cue("month");
  }, [shown, main.amount]);
  if (report === null) return null;
  const draw = drawShown(view);
  const save = savings(view);
  const story = storyLines([...midMonth, ...report.lines]);
  const news = untoldLines([...midMonth, ...report.lines]).length;
  const chapterClosed = report.lines.some((line) => line.key === CHAPTER_CLOSED);
  const close = (): void => {
    cue("close");
    setReportOpen(false);
  };

  return (
    <WorldSheet
      open={shown}
      onClose={close}
      label={clock}
      title={turnWords("turn.results.title")}
      mark="results"
      foot={
        <button type="button" className="btn-main" onClick={close} data-results-back>
          <span className="truncate">{turnWords("turn.results.back", { place })}</span>
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        {quiet.length === 0 ? null : (
          <section className="flex flex-col gap-1" aria-label={turnWords("turn.results.quiet")} data-results-quiet={quiet.length}>
            <h3 className="label text-text-2">{turnWords("turn.results.quiet")}</h3>
            <ul className="flex flex-col">
              {quiet.map((lines, index) => (
                <li key={index} className="flex items-baseline gap-3 border-b border-sheet-line py-2 last:border-b-0" data-quiet-line>
                  <span className="num w-[72px] shrink-0 text-[12px] text-text-2">{say("ui.world.age", { years: Math.floor((ageMonths - quiet.length + index) / 12), months: (ageMonths - quiet.length + index) % 12 })}</span>
                  <span className="min-w-0 flex-1 text-[14px] leading-snug font-semibold">{quietWords(lines, local)}</span>
                </li>
              ))}
            </ul>
            <h3 className="label mt-2 text-text-2">{turnWords("turn.results.stopped")}</h3>
          </section>
        )}
        {birthday ? <p className="text-[14px] font-bold text-strong" data-results-birthday>{turnWords("turn.results.birthday", { years: Math.floor(ageMonths / 12) })}</p> : null}
        {lines.length === 0 ? (
          // No money moved: said plainly, never "+₦0" (R-WORLD-008).
          <div className="flex items-baseline justify-between gap-3" data-results-kept={0}>
            <span className="text-[22px] leading-none font-bold">{turnWords("turn.results.nothing-moved")}</span>
          </div>
        ) : (
          <div className="flex items-baseline justify-between gap-3" data-results-kept={main.amount}>
            <span className="text-[14px] font-semibold">{turnWords(main.amount < 0 ? "turn.results.lost" : "turn.results.kept")}</span>
            <Counter value={counted} format={(value) => signed(value, value, main.currency)} className={`text-[32px] leading-none ${main.amount < 0 ? "text-out" : "text-in"}`} />
          </div>
        )}
        {rest.map((net) => (
          <div key={net.currency} className="-mt-3 flex justify-end">
            <span className={`num text-[15px] ${net.amount < 0 ? "text-out" : "text-in"}`}>{signed(net.amount, net.amount, net.currency)}</span>
          </div>
        ))}

        {story.length === 0 ? null : (
          <section className="flex flex-col gap-1" aria-label={turnWords("turn.results.story")} data-results-story>
            <h3 className="label text-text-2">{turnWords("turn.results.story")}</h3>
            <ul className="flex flex-col">
              {story.map((line, index) => {
                const told = toldOnResults(line);
                const unpaid = isUnpaid(line);
                const lead = leadsAlone(line);
                // The grant leads alone, larger; a bill not paid is in red though no money moved.
                const tone = lead ? "pb-3 text-[18px] leading-tight font-bold" : unpaid ? "text-[14px] leading-snug font-semibold text-out" : "text-[14px] leading-snug font-semibold";
                return (
                  <li key={`${line.key}-${String(index)}`} className={`border-b border-sheet-line py-2 last:border-b-0 ${tone}`} data-story-line={line.key} data-tone={line.tone} data-unpaid={unpaid ? "true" : undefined} data-story-lead={lead ? "true" : undefined}>
                    {words(told.key, told.params)}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {chapterClosed ? (
          <p className="text-[14px] font-bold text-strong" data-results-months-full>
            {say("ui.months.full-again", { count: view.turns.banked })}
          </p>
        ) : null}

        <section className="flex flex-col gap-1" aria-label={turnWords("turn.results.money")}>
          <h3 className="label text-text-2">{turnWords("turn.results.money")}</h3>
          {lines.length === 0 ? (
            <p className="text-[14px] text-text-2">{turnWords("turn.results.no-money")}</p>
          ) : (
            <ul className="flex flex-col" data-results-lines>
              {lines.map(({ line, sign, amount, currency }, index) => (
                <li key={`${line.key}-${String(index)}`} className="flex items-baseline justify-between gap-3 border-b border-sheet-line py-2 last:border-b-0" data-sign={sign}>
                  <span className="min-w-0 flex-1 text-[14px] leading-snug">{words(line.key, line.params)}</span>
                  <span className={`num shrink-0 text-[15px] ${sign < 0 ? "text-out" : "text-in"}`}>{signed(sign, amount, currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

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
          </section>
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

        {news === 0 ? null : <p className="text-[13px] text-text-2">{turnWords("turn.results.news")}</p>}
      </div>
    </WorldSheet>
  );
}

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const share = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)} className="h-2.5 w-full overflow-hidden rounded-full bg-sheet-muted">
      <div className="h-full rounded-full bg-strong transition-[width] duration-450" style={{ width: `${String(share * 100)}%` }} />
    </div>
  );
}
