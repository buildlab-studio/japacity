// The news that has reached this character, newest stage first within each,
// under the front page: the era the world is in (director.md, era stories go
// to the front page) and, online, the last Friday draw (lottery.md R-LOTTERY-016).
import type { NewsStage, PlayerView } from "@japacity/sim";
import { Newspaper } from "lucide-react";

import { useView } from "../../authority/GameProvider";
import { Card, Empty, Panel, Tag } from "../../shared/ui/Panel";
import { monthEnding, playerMonth } from "../../shared/words/format";
import { blurbOf, nameOf, say, sayCount, words } from "../../shared/words/text";

/**
 * When the era began and when it ends, in the months the header counts
 * (R-DIRECTOR-002): the view's `sinceMonth` and `untilMonth` count from 0, and
 * an era runs up to the month before its end tick.
 */
function eraMonths(era: NonNullable<PlayerView["era"]>, month: number): string {
  const since = playerMonth(era.sinceMonth);
  const last = monthEnding(era.untilMonth);
  const left = Math.max(0, era.untilMonth - month);
  const began = since < 1 ? say("ui.news.era-before") : say("ui.news.era-since", { month: since });
  return `${began} ${sayCount("ui.news.era-until", left, { month: last, months: left })}`;
}

function FrontPage() {
  const { era, month } = useView();
  if (era === null) return null;
  return (
    <div className="flex flex-col gap-1 rounded-2xl border-2 border-ink bg-surface p-4" data-era={era.id}>
      <p className="text-xs font-semibold tracking-widest text-muted uppercase">{say("ui.news.era")}</p>
      <h3 className="font-display text-3xl leading-tight">{nameOf(era.id)}</h3>
      <p className="text-sm font-medium text-muted tabular-nums" data-era-months>
        {eraMonths(era, month)}
      </p>
      {blurbOf(era.id) === null ? null : <p>{blurbOf(era.id)}</p>}
    </div>
  );
}

/**
 * R-LOTTERY-016: the last Friday draw on the front page: the jackpot and how
 * many tickets won, never who.
 */
export function drawnWords(last: NonNullable<NonNullable<PlayerView["lottery"]>["last"]>): string {
  const winners = last.winners.reduce((sum, tier) => sum + tier.tickets.length, 0);
  const jackpot = last.winners.find((tier) => tier.tier === "jackpot" && tier.tickets.length > 0);
  if (winners === 0) return say("ui.news.drawn-none", { draw: last.draw });
  if (jackpot === undefined) return say("ui.news.drawn-no-jackpot", { draw: last.draw, winners });
  return sayCount("ui.news.drawn", winners, { draw: last.draw, jackpot: { currency: "NGN", amount: jackpot.amount }, winners });
}

function DrawnLine() {
  const { lottery } = useView();
  const last = lottery?.last ?? null;
  if (last === null) return null;
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4" data-news-drawn={last.draw}>
      <p className="text-xs font-semibold tracking-widest text-muted uppercase">{say("ui.news.draw-kicker")}</p>
      <p className="font-medium">{drawnWords(last)}</p>
    </div>
  );
}

/** The order stages are shown in: what is happening now first, talk next, the past last. */
const STAGE_ORDER: readonly NewsStage[] = ["in-force", "announced", "rumour", "ended"];

export function NewsView() {
  const { news, era, lottery } = useView();
  // The empty line never sits under a story the front page already shows.
  const frontPage = era !== null || (lottery?.last ?? null) !== null;
  const stories = [...news].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || b.since - a.since);
  return (
    <Panel title={say("ui.news.title")}>
      <FrontPage />
      <DrawnLine />
      {stories.length === 0 ? (
        <Empty>{say(frontPage ? "ui.news.none-else" : "ui.news.none")}</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {stories.map((story) => (
            <li key={story.id}>
              <Card tone={story.forYou ? "attention" : "plain"} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Newspaper size={16} className="text-muted" />
                  <Tag>{say(`ui.news.stage.${story.stage}`)}</Tag>
                  {story.forYou ? <Tag tone="accent">{say("ui.news.for-you")}</Tag> : null}
                </div>
                <h3 className="font-semibold">{words(`${story.id}.${story.stage}.head`)}</h3>
                <p className="text-sm">{words(`${story.id}.${story.stage}.body`)}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
