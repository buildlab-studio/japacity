// The staged wins (docs/rules/text.md: the first salary, the visa grant, the
// first dollar salary, the send-off, the first pay abroad): each big line gets
// the whole screen before the month report opens. One at a time, in order.
import { Dialog } from "@base-ui/react/dialog";

import { useGame } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { FullScreen } from "../../shared/ui/FullScreen";
import { say, words } from "../../shared/words/text";

export function Moment() {
  const moments = useGame((state) => state.moments);
  const nextMoment = useGame((state) => state.nextMoment);
  const line = moments[0];
  if (line === undefined) return null;
  const said = words(line.key, line.params);
  return (
    <FullScreen open onClose={nextMoment} title={said} tone={line.tone === "bad" ? "ink" : "accent"}>
      <div className="flex max-w-xl flex-col items-center gap-8 text-center" data-moment={line.key}>
        <p className="text-sm font-semibold tracking-widest uppercase opacity-80">{say("ui.moment.kicker")}</p>
        <Dialog.Title className="font-display text-4xl leading-tight sm:text-6xl">{said}</Dialog.Title>
        <Button variant="secondary" onClick={nextMoment} className="min-w-40" autoFocus>
          {moments.length > 1 ? say("ui.moment.next") : say("ui.moment.done")}
        </Button>
      </div>
    </FullScreen>
  );
}
