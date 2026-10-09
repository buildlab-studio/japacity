// News (docs/rules/world.md R-WORLD-008, R-WORLD-018): the era line, the last month's report lines
// (they stay here after the results sheet), and the stories that have reached the character.
import { content } from "@japacity/content";
import type { NewsStage, ReportLine, RouteStateName } from "@japacity/sim";

import { useGame, useView } from "../../../authority/GameProvider";
import { isUnpaid, tidyLines, toldUnpaid } from "../../../shared/words/lines";
import { blurbOf, monthsAgo, nameOf, say, words } from "../../../shared/words/text";
import { Head } from "../act";
import { phoneWords } from "../phone.words";

/** What is happening now first, talk next, the past last. */
const STAGE_ORDER: readonly NewsStage[] = ["in-force", "announced", "rumour", "ended"];

/** A route the character has flown on, or holds a visa for, is behind them: its news no longer asks for them. */
const BEHIND: readonly RouteStateName[] = ["granted", "departed"];

/**
 * A story is for the character only while it names a route still in play for them: the engine marks any story about a route they have heard of, so once landed, "Refusals climb" would
 * still say for you.
 */
export function storyForYou(story: { id: string; forYou: boolean }, routes: readonly { id: string; state: RouteStateName }[]): boolean {
  if (!story.forYou) return false;
  const touches = content.news[story.id as keyof typeof content.news]?.touches ?? [];
  return touches.some((route) => {
    const state = routes.find((candidate) => candidate.id === route)?.state;
    return state !== undefined && state !== "unknown" && !BEHIND.includes(state);
  });
}

/** The settlement cleared (docs/rules/home.md R-HOME-003): it leads News as it leads the results. */
const EVICTED = "line.home.evicted";
/** The story of the clearing, carried the month it happens: the character's own news, so the world's schedule never holds it. */
const CLEARED = "news.makoko-cleared";

function leads(line: ReportLine): boolean {
  return line.key === EVICTED || isUnpaid(line) || line.key.startsWith("ui.results.unpaid");
}

/** Money that went unpaid leads News as it leads the results (R-WORLD-008), after the room cleared away. */
function newsOrder(lines: readonly ReportLine[]): ReportLine[] {
  return [...lines.filter((line) => line.key === EVICTED), ...lines.filter((line) => leads(line) && line.key !== EVICTED), ...lines.filter((line) => !leads(line))];
}

export function News() {
  const { news, era, report, month, routes } = useView();
  // R-WORLD-008: the month's lines stay here, those of what was done mid-month (an agent paid, an ask answered) first.
  const midMonth = useGame((state) => state.lastMonthLines);
  const world = [...news].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || b.since - a.since);
  const cleared = (report?.lines ?? []).some((line) => line.key === EVICTED);
  const stories = cleared ? [{ id: CLEARED, stage: "in-force" as const, since: report?.month ?? month, forYou: false }, ...world] : world;
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
            {newsOrder(tidyLines([...midMonth, ...report.lines]).map(toldUnpaid)).map((line, index) => (
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
            <li key={story.id} data-story={story.id} className={`rounded-[6px] border bg-sheet-2 p-3 ${storyForYou(story, routes) ? "border-signal" : "border-sheet-line"}`}>
              <p className="label text-text-2">
                {say(`ui.news.stage.${story.stage}`)}
                {storyForYou(story, routes) ? ` · ${say("ui.news.for-you")}` : ""}
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
