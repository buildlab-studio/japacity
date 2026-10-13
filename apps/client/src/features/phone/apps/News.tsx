// News (docs/rules/world.md R-WORLD-008, R-WORLD-018): the era line, the last month's report lines
// (they stay here after the results sheet), and the stories that have reached the character.
import { content } from "@japacity/content";
import type { NewsStage, RouteStateName } from "@japacity/sim";

import { useGame, useView } from "../../../authority/GameProvider";
import { nowLineWords } from "../../../shared/words/acts";
import { newsLines } from "../../../shared/words/told";
import { blurbOf, monthsAgo, nameOf, say, words } from "../../../shared/words/text";
import { SourceMark } from "../../../shared/ui/NewsSource";
import { TILE_TABLE } from "../../../shared/tiles/tiles.data";
import { Head } from "../act";
import { phoneWords } from "../phone.words";
import { PicCard } from "../ui";

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
const EVICTED: ReadonlySet<string> = new Set(["line.home.evicted", "line.home.evicted-no-cash"]);
/** The story of the clearing, carried the month it happens: the character's own news, so the world's schedule never holds it. */
const CLEARED = "news.makoko-cleared";

/** A story's picture: the way out it touches, where the tiles have one, else the paper. */
function storyPicture(id: string): string {
  const touches = content.news[id as keyof typeof content.news]?.touches ?? [];
  return touches.find((route) => TILE_TABLE[route] !== undefined) ?? "phone.news";
}

export function News() {
  const view = useView();
  const { news, era, report, month, routes } = view;
  // R-WORLD-008: the month's lines stay here, those of what was done mid-month (an agent paid, an ask answered) first.
  const midMonth = useGame((state) => state.lastMonthLines);
  const world = [...news].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || b.since - a.since);
  const cleared = (report?.lines ?? []).some((line) => EVICTED.has(line.key));
  const stories = cleared ? [{ id: CLEARED, stage: "in-force" as const, since: report?.month ?? month, forYou: false }, ...world] : world;
  return (
    <div data-phone-app="news">
      {era === null ? null : (
        <PicCard pic="phone.news" tint="plain" over={say("ui.news.era")} title={nameOf(era.id)} line={blurbOf(era.id)} data-era={era.id} />
      )}

      {report === null ? null : (
        <div data-report={report.month}>
          <Head>{phoneWords("phone.news.month", { when: monthsAgo(report.month, month) })}</Head>
          {/* The month's lines are told as the results tell them, money too (shared/words/told.ts, R-WORLD-008; the eleventh
              review), each as a chip: good news in green, a loss plain, never louder than the good. */}
          <ul className="flex flex-wrap gap-2">
            {newsLines(midMonth, report.lines, view).map((line, index) => (
              <li
                key={`${line.key}-${String(index)}`}
                className={`sticker-chip text-[14px] chip-wrap ${line.tone === "good" ? "bg-tint-money" : line.tone === "bad" ? "bg-sheet-2" : "bg-tint-study"}`}
                style={{ rotate: `${String(index % 2 === 0 ? -1.5 : 1.5)}deg`, ...(line.tone === "good" ? { color: "var(--money-ink)" } : {}) }}
                data-tone={line.tone}
              >
                {nowLineWords(line)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Head>{say("ui.news.title")}</Head>
      {stories.length === 0 ? (
        <p className="px-0.5 text-[15px] text-text-2">{say("ui.news.none")}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {stories.map((story) => {
            const forYou = storyForYou(story, routes);
            return (
              <li key={story.id} data-story={story.id}>
                <PicCard
                  pic={storyPicture(story.id)}
                  tint={forYou ? "money" : "study"}
                  picked={forYou}
                  over={
                    <>
                      <SourceMark id={story.id} stage={story.stage} />
                      {forYou ? ` · ${say("ui.news.for-you")}` : ""}
                    </>
                  }
                  title={words(`${story.id}.${story.stage}.head`)}
                  line={words(`${story.id}.${story.stage}.body`)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
