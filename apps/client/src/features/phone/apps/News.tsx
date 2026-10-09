// News (docs/rules/world.md R-WORLD-008, R-WORLD-018): the era line, the last month's report lines
// (they stay here after the results sheet), and the stories that have reached the character.
import type { NewsStage } from "@japacity/sim";

import { useGame, useView } from "../../../authority/GameProvider";
import { tidyLines, toldUnpaid } from "../../../shared/words/lines";
import { blurbOf, monthsAgo, nameOf, say, words } from "../../../shared/words/text";
import { Head } from "../act";
import { phoneWords } from "../phone.words";

/** What is happening now first, talk next, the past last. */
const STAGE_ORDER: readonly NewsStage[] = ["in-force", "announced", "rumour", "ended"];

export function News() {
  const { news, era, report, month } = useView();
  // R-WORLD-008: the month's lines stay here, those of what was done mid-month (an agent paid, an ask answered) first.
  const midMonth = useGame((state) => state.lastMonthLines);
  const stories = [...news].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || b.since - a.since);
  return (
    <div data-phone-app="news">
      {era === null ? null : (
        <div className="band rounded-[6px] px-4 py-3" data-era={era.id}>
          <div className="label label-strong">{say("ui.news.era")}</div>
          <div className="title text-[20px] leading-tight">{nameOf(era.id)}</div>
          {blurbOf(era.id) === null ? null : <p className="mt-1 text-[13px] opacity-85">{blurbOf(era.id)}</p>}
        </div>
      )}

      {report === null ? null : (
        <div data-report={report.month}>
          <Head>{phoneWords("phone.news.month", { when: monthsAgo(report.month, month) })}</Head>
          <ul className="flex flex-col divide-y divide-sheet-line">
            {tidyLines([...midMonth, ...report.lines]).map(toldUnpaid).map((line, index) => (
              <li key={`${line.key}-${String(index)}`} className={`py-1.5 text-[14px] ${line.tone === "good" ? "text-in" : line.tone === "bad" ? "text-out" : "text-text"}`}>
                {words(line.key, line.params)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Head>{say("ui.news.title")}</Head>
      {stories.length === 0 ? (
        <p className="text-[14px] text-text-2">{say("ui.news.none")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {stories.map((story) => (
            <li key={story.id} data-story={story.id} className={`rounded-[6px] border bg-sheet-2 p-3 ${story.forYou ? "border-signal" : "border-sheet-line"}`}>
              <p className="label text-text-2">
                {say(`ui.news.stage.${story.stage}`)}
                {story.forYou ? ` · ${say("ui.news.for-you")}` : ""}
              </p>
              <p className="mt-0.5 text-[15px] font-bold">{words(`${story.id}.${story.stage}.head`)}</p>
              <p className="mt-0.5 text-[13px] text-text-2">{words(`${story.id}.${story.stage}.body`)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
