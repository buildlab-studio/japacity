// Life goals: the open ones with their items met or not, the way the chapter
// shows its own, and the done list with the month each was done (goal.md, the
// view rule). Goals gate nothing: they are what could come next.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { Check, Circle, Trophy } from "lucide-react";

import { useView } from "../../authority/GameProvider";
import { Card, Panel, Tag } from "../../shared/ui/Panel";
import { monthEnding } from "../../shared/words/format";
import { anyOptions, requirementSentence } from "../../shared/words/requirement";
import { blurbOf, hasWords, nameOf, say, words } from "../../shared/words/text";

/**
 * An item's words: content's own key when it has one, else the sentence for
 * the goal's requirement at that place in its `doneIf`.
 */
export function goalItemWords(goal: Id<"goal">, item: string): string {
  const key = `${goal}.item.${item}`;
  if (hasWords(key)) return words(key);
  const requirement = /^\d+$/.test(item) ? content.goal[goal]?.doneIf[Number(item)] : undefined;
  return requirement === undefined ? say("ui.goal.item", { n: item }) : requirementSentence(requirement);
}

/** The paths of an item that any one of several meets, when content names the item in its own words; its sentence already lists them otherwise. */
function goalItemOptions(goal: Id<"goal">, item: string): string[] {
  if (!hasWords(`${goal}.item.${item}`)) return [];
  const requirement = /^\d+$/.test(item) ? content.goal[goal]?.doneIf[Number(item)] : undefined;
  return requirement === undefined ? [] : anyOptions(requirement);
}

export function GoalView() {
  const view = useView();
  const { open, done } = view.goals;
  if (open.length === 0 && done.length === 0) {
    return view.place.where === "abroad" ? (
      <Panel title={say("ui.goal.title")}>
        <p className="text-muted">{say("ui.goal.none")}</p>
      </Panel>
    ) : null;
  }
  return (
    <Panel title={say("ui.goal.title")}>
      {open.length === 0 ? null : (
        <ul className="flex flex-col gap-3">
          {open.map((goal) => (
            <li key={goal.id} data-goal={goal.id}>
              <Card className="flex flex-col gap-2">
                <h3 className="font-semibold">{nameOf(goal.id)}</h3>
                {blurbOf(goal.id) === null ? null : <p className="text-sm text-muted">{blurbOf(goal.id)}</p>}
                <ul className="flex flex-col gap-1">
                  {goal.items.map((item) => (
                    <li key={item.id} data-met={item.met ? "true" : "false"} className="flex items-start gap-2 text-sm">
                      {item.met ? <Check size={16} className="mt-0.5 shrink-0 text-good" /> : <Circle size={16} className="mt-0.5 shrink-0 text-muted" />}
                      <span className={item.met ? "text-muted line-through" : ""}>
                        {goalItemWords(goal.id, item.id)}
                        {goalItemOptions(goal.id, item.id).length < 2 ? null : (
                          <span className="mt-1 block text-muted" data-one-of>
                            {say("ui.chapter.one-of")} {goalItemOptions(goal.id, item.id).join("; ")}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {done.length === 0 ? null : (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{say("ui.goal.done")}</h3>
          <ul className="flex flex-wrap gap-2">
            {done.map((goal) => (
              <li key={goal.id}>
                <Tag tone="good">
                  <Trophy size={12} />
                  {say("ui.goal.done-item", { goal: nameOf(goal.id), month: monthEnding(goal.month) })}
                </Tag>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
