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

export function QualityView() {
  const view = useView();
  const shown = view.qualities.filter((quality) => content.quality[quality.id]?.shown === true);
  return (
    <Panel title={say("ui.profile.title")}>
      <Card>
        <dl className="grid gap-3 @sm:grid-cols-2">
          {shown.map(({ id, value }) => {
            const entry = content.quality[id];
            const ranged = entry !== undefined && id !== AGE && !hasWords(`${id}.value.${String(value)}`);
            return (
              <div key={id} className="flex flex-col gap-1">
                <dt className="text-sm text-muted">{nameOf(id)}</dt>
                <dd className="font-semibold">{valueWords(id, value)}</dd>
                {ranged ? <Meter value={value - entry.min} max={entry.max - entry.min} label={nameOf(id)} tone="ink" /> : null}
              </div>
            );
          })}
        </dl>
      </Card>
    </Panel>
  );
}
