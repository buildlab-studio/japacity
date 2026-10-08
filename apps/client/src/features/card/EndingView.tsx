// The end of a life on the road: the ending card and the real-story card, and
// nothing else can be done (road.md, the rule on the ending). The authority may
// still grant turns; nothing here uses them.
import type { PlayerView } from "@japacity/sim";

import { useView } from "../../authority/GameProvider";
import { say } from "../../shared/words/text";
import { ShareCardFace } from "./ShareCard";

export function EndingView() {
  const { card } = useView();
  if (card === null) return null;
  const story: NonNullable<PlayerView["card"]> = { ...card, kind: "real-story" };
  return (
    <main className="flex min-h-dvh flex-col items-center gap-6 bg-ink px-4 py-8 text-paper" data-ending>
      <h1 className="sr-only">{say("ui.card.lost.title")}</h1>
      <div className="flex flex-wrap justify-center gap-6">
        {card.kind === "real-story" ? null : <ShareCardFace card={card} />}
        <ShareCardFace card={story} />
      </div>
    </main>
  );
}
