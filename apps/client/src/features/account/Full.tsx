// The full screen (docs/rules/server.md R-SERVER-032): what a new visitor sees
// while sign-ups are switched off. One line, no sign-in form, and a check
// that runs by itself once the server's wait is over. The button checks again
// only after that wait too, so a crowd waiting here never asks faster than
// the server allows.
import { useCallback, useEffect, useState } from "react";

import { Button } from "../../shared/ui/Button";
import { say } from "../../shared/words/text";

export type FullCheck = "full" | "open";

export interface FullProps {
  /** Seconds to wait before asking again: the refusal's `retryAfter` (`switches.retryMs`). */
  retryAfter: number;
  /** Asks the server again. Rejects when it cannot be reached. */
  check: () => Promise<FullCheck>;
  /** Called once, when the server lets visitors in again. */
  onOpen: () => void;
}

type Stage = "waiting" | "checking" | "unreachable";

const SECOND_MS = 1000;

export function Full({ retryAfter, check, onOpen }: FullProps) {
  const [stage, setStage] = useState<Stage>("waiting");
  // Each wait is its own round, so a check that answers within the same render still starts the next wait.
  const [round, setRound] = useState(0);

  const ask = useCallback(() => {
    setStage("checking");
    check()
      .then((answer) => {
        if (answer === "open") {
          onOpen();
          return;
        }
        setStage("waiting");
        setRound((done) => done + 1);
      })
      .catch(() => {
        setStage("unreachable");
      });
  }, [check, onOpen]);

  useEffect(() => {
    if (stage !== "waiting") return;
    const timer = setTimeout(ask, Math.max(1, retryAfter) * SECOND_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [stage, round, retryAfter, ask]);

  return (
    <section className="flex flex-col gap-4" aria-live="polite">
      <h1 className="text-2xl font-bold">{say("server.full")}</h1>
      <div>
        <Button variant="primary" disabled={stage === "waiting" || stage === "checking"} onClick={ask}>
          {say("ui.full.check")}
        </Button>
      </div>
      {stage === "unreachable" ? (
        <p role="alert" className="text-bad">
          {say("ui.account.fail.unreachable")}
        </p>
      ) : null}
    </section>
  );
}
