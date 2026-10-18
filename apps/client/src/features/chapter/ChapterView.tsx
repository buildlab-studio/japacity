// The main journey: the current chapter's title, opening line and items, in the life's own words. An
// item that any one of several paths meets lists them as "one of" (chapter 6,
// Secure). Once every chapter is done the long game takes the chapter's place:
// the open goals, each with how many of its items are met (chapter:long-game-after-last-chapter).
import { content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";
import { Check, Circle } from "lucide-react";

import { useView } from "../../authority/GameProvider";
import { Card, Tag } from "../../shared/ui/Panel";
import { anyOptions } from "../../shared/words/requirement";
import { openingKey, ownWords } from "../../shared/words/sixteen";
import { nameOf, say, words } from "../../shared/words/text";

function itemOptions(chapter: Id<"chapter">, item: string, view: PlayerView): string[] {
  const requirement = content.chapter[chapter]?.items.find((entry) => entry.id === item)?.requirement;
  return requirement === undefined ? [] : anyOptions(requirement, { routes: view.routes });
}

function Items({ chapter }: { chapter: Id<"chapter"> }) {
  const view = useView();
  return (
    <ul className="flex flex-col gap-1">
      {view.chapter.items.map((item) => {
        const options = itemOptions(chapter, item.id, view);
        return (
          <li key={item.id} data-met={item.met ? "true" : "false"} className="flex items-start gap-2">
            {item.met ? <Check size={18} className="mt-0.5 shrink-0 text-good" /> : <Circle size={18} className="mt-0.5 shrink-0 text-text-2" />}
            <div className="flex flex-col gap-1">
              <span className={item.met ? "text-text-2 line-through" : ""}>{words(ownWords(view, `${chapter}.item.${item.id}`))}</span>
              {options.length < 2 ? null : (
                <div className="text-sm text-text-2" data-one-of>
                  <p className="font-medium">{say("ui.chapter.one-of")}</p>
                  <ul className="list-disc pl-5">
                    {options.map((option) => (
                      <li key={option}>{option}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** What the view shows in the chapter's place once the chapters are over. */
function LongGame() {
  const { goals } = useView();
  return (
    <div className="flex flex-col gap-2" data-long-game>
      <h2 className="text-3xl leading-tight font-bold">{say("ui.chapter.long-game")}</h2>
      <p className="text-text-2">{say(goals.open.length === 0 ? "ui.chapter.long-game-none" : "ui.chapter.long-game-intro")}</p>
      {goals.open.length === 0 ? null : (
        <ul className="flex flex-col gap-1">
          {goals.open.map((goal) => (
            <li key={goal.id} className="flex items-baseline justify-between gap-3">
              <span>{nameOf(goal.id)}</span>
              <span className="text-sm text-text-2 tabular-nums">
                {say("ui.chapter.goal-items", { met: goal.items.filter((item) => item.met).length, total: goal.items.length })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ChapterView() {
  const view = useView();
  const { chapter } = view;
  const current = chapter.current;
  const allDone = current === null && chapter.done.length > 0;
  return (
    <section aria-label={current === null ? say("ui.chapter.all-done") : words(`${current}.title`)}>
      <Card className="flex flex-col gap-3">
        {current === null ? (
          <>
            <p className="text-2xl font-bold">{say("ui.chapter.all-done")}</p>
            {allDone ? <LongGame /> : null}
          </>
        ) : (
          <>
            <h2 className="text-2xl leading-tight font-bold">{words(`${current}.title`)}</h2>
            <p className="text-text-2 italic">{words(openingKey(view))}</p>
            <Items chapter={current} />
          </>
        )}
        {chapter.done.length === 0 ? null : (
          <div className="flex flex-wrap items-center gap-2 border-t border-sheet-line pt-3 text-sm">
            <span className="text-text-2">{say("ui.chapter.done")}:</span>
            {chapter.done.map((id) => (
              <Tag key={id} tone="good">
                {words(`${id}.title`)}
              </Tag>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
