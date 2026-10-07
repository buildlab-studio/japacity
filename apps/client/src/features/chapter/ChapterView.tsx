// The main journey: the current chapter's title, opening line and items.
import { Check, Circle } from "lucide-react";

import { useView } from "../../authority/GameProvider";
import { Card, Tag } from "../../shared/ui/Panel";
import { say, words } from "../../shared/words/text";

export function ChapterView() {
  const { chapter } = useView();
  const current = chapter.current;
  return (
    <section aria-label={current === null ? say("ui.chapter.all-done") : words(`${current}.title`)}>
      <Card className="flex flex-col gap-3">
        {current === null ? (
          <p className="font-display text-2xl">{say("ui.chapter.all-done")}</p>
        ) : (
          <>
            <h2 className="font-display text-3xl leading-tight">{words(`${current}.title`)}</h2>
            <p className="text-muted italic">{words(`${current}.open`)}</p>
            <ul className="flex flex-col gap-1">
              {chapter.items.map((item) => (
                <li key={item.id} data-met={item.met ? "true" : "false"} className="flex items-start gap-2">
                  {item.met ? <Check size={18} className="mt-0.5 shrink-0 text-good" /> : <Circle size={18} className="mt-0.5 shrink-0 text-muted" />}
                  <span className={item.met ? "text-muted line-through" : ""}>{words(`${current}.item.${item.id}`)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {chapter.done.length === 0 ? null : (
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm">
            <span className="text-muted">{say("ui.chapter.done")}:</span>
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
