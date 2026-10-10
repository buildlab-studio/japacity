// The age screen (R-ACCOUNT-012). The server decides and keeps no date of birth; this screen only sends
// what was typed, with the bot check's token, which the server reads here, the one step every new
// account takes (R-ACCOUNT-013, apps/server/src/routes/age.ts).
import { useState, type FormEvent } from "react";

import type { AccountApi, AgeStanding, Full } from "../../shared/net/auth";
import { Button } from "../../shared/ui/Button";
import { say } from "../../shared/words/text";
import { Turnstile, type LoadTurnstile } from "./Turnstile";

export interface AgeScreenProps {
  account: AccountApi;
  sitekey: string | null;
  load: LoadTurnstile;
  onStanding: (standing: AgeStanding | Full) => void;
}

export function AgeScreen({ account, sitekey, load, onStanding }: AgeScreenProps) {
  const [birth, setBirth] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [bot, setBot] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  async function answer(event: FormEvent) {
    event.preventDefault();
    if (birth === "") {
      setProblem(say("ui.account.age.empty"));
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const answer = await account.declareAge(birth, bot);
      // A token is good once, whatever the server answered.
      if (bot !== null) {
        setBot(null);
        setRound((count) => count + 1);
      }
      if (answer === "bad-date") setProblem(say("ui.account.age.bad-date"));
      else if (answer === "bot-check") setProblem(say("ui.account.bot.failed"));
      else onStanding(answer);
    } catch {
      setProblem(say("ui.account.fail.unreachable"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void answer(event)} noValidate>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{say("ui.account.age.title")}</h1>
        <p className="text-text-2">{say("ui.account.age.intro")}</p>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{say("ui.account.age.label")}</span>
        <input className="min-h-11 rounded-md border border-sheet-line bg-sheet-2 px-3 text-base" type="date" autoComplete="bday" value={birth} onChange={(event) => setBirth(event.target.value)} />
      </label>
      <div>
        <Button type="submit" variant="primary" disabled={busy}>
          {say("ui.account.age.go")}
        </Button>
      </div>
      {problem === null ? null : (
        <p role="alert" className="text-bad">
          {problem}
        </p>
      )}
      {sitekey === null ? null : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-2">{say("ui.account.bot")}</p>
          <Turnstile sitekey={sitekey} load={load} round={round} onToken={setBot} />
        </div>
      )}
    </form>
  );
}
