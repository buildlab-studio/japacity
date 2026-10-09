// Who to be: shown for a new life, or when a saved life could not come along.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";

import { useGame } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Panel";
import { blurbOf, nameOf, say } from "../../shared/words/text";

const SCENARIOS = Object.keys(content.scenario) as Id<"scenario">[];

export function ScenarioView() {
  const notice = useGame((state) => state.notice);
  const chooseLife = useGame((state) => state.chooseLife);
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <p className="text-xl font-bold">{say("ui.game")}</p>
        <h1 className="text-3xl font-bold">{say("ui.life.title")}</h1>
        <p className="text-text-2">{say("ui.life.intro")}</p>
      </div>
      {notice === null ? null : (
        <p role="status" className="rounded-md border-l-4 border-l-accent bg-sheet-2 p-4">
          {say(notice)}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {SCENARIOS.map((id) => (
          <li key={id}>
            <Card className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold">{nameOf(id)}</h2>
              {blurbOf(id) === null ? null : <p className="text-text-2">{blurbOf(id)}</p>}
              <div>
                <Button variant="primary" aria-label={`${say("ui.life.start")}: ${nameOf(id)}`} onClick={() => void chooseLife(id)}>
                  {say("ui.life.start")}
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}
