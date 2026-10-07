// The profile: every quality content marks as shown, with its name.
import { content } from "@japacity/content";

import { useView } from "../../authority/GameProvider";
import { Meter } from "../../shared/ui/Meter";
import { Card, Panel } from "../../shared/ui/Panel";
import { formatNumber } from "../../shared/words/format";
import { hasWords, nameOf, say } from "../../shared/words/text";

const AGE = "quality.age-months";
const MONTHS_IN_YEAR = 12;

/** A value as the player reads it: a named level where content names one, years for age, else the number. */
function valueWords(id: string, value: number): string {
  if (id === AGE) return say("ui.profile.age", { years: Math.floor(value / MONTHS_IN_YEAR) });
  const label = `${id}.value.${String(value)}`;
  return hasWords(label) ? say(label) : formatNumber(value);
}

/**
 * Qualities that only start to count once you have left. At home they sit at
 * nothing for most lives, so they wait in one folded group until they move.
 */
const LATER = new Set(["quality.credit-mark", "quality.care", "quality.family-stake", "quality.land"]);

function Quality({ id, value }: { id: string; value: number }) {
  const entry = content.quality[id as keyof typeof content.quality];
  const ranged = entry !== undefined && id !== AGE && !hasWords(`${id}.value.${String(value)}`);
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-muted">{nameOf(id)}</dt>
      <dd className="font-semibold">{valueWords(id, value)}</dd>
      {ranged ? <Meter value={value - entry.min} max={entry.max - entry.min} label={nameOf(id)} tone="ink" /> : null}
    </div>
  );
}

export function QualityView() {
  const view = useView();
  const shown = view.qualities.filter((quality) => content.quality[quality.id]?.shown === true);
  const atHome = view.place.where === "home";
  const waiting = (quality: { id: string; value: number }) => atHome && LATER.has(quality.id) && quality.value === 0;
  const now = shown.filter((quality) => !waiting(quality));
  const later = shown.filter(waiting);
  return (
    <Panel title={say("ui.profile.title")}>
      <Card className="flex flex-col gap-4">
        <dl className="grid gap-3 @sm:grid-cols-2">
          {now.map(({ id, value }) => (
            <Quality key={id} id={id} value={value} />
          ))}
        </dl>
        {later.length === 0 ? null : (
          <details className="border-t border-line pt-3" data-later>
            <summary className="cursor-pointer text-sm font-semibold">{say("ui.profile.later")}</summary>
            <dl className="mt-3 grid gap-3 @sm:grid-cols-2">
              {later.map(({ id, value }) => (
                <Quality key={id} id={id} value={value} />
              ))}
            </dl>
          </details>
        )}
      </Card>
    </Panel>
  );
}
