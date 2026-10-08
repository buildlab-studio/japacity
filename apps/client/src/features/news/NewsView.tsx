// The news that has reached this character, newest stage first within each,
// under the front page: the era the world is in (director.md, era stories go
// to the front page).
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

/** The order stages are shown in: what is happening now first, talk next, the past last. */
const STAGE_ORDER: readonly NewsStage[] = ["in-force", "announced", "rumour", "ended"];

export function NewsView() {
  const { news } = useView();
  const stories = [...news].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || b.since - a.since);
  return (
    <Panel title={say("ui.news.title")}>
      <FrontPage />
      {stories.length === 0 ? (
        <Empty>{say("ui.news.none")}</Empty>
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
