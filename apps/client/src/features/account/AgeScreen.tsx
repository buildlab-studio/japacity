// The age screen (R-ACCOUNT-012): before any sign-in method, a date of birth
// with no date filled in and no hint of the age needed. The server decides
// and keeps no date of birth; this screen only sends what was typed.
import { useState, type FormEvent } from "react";

import type { AccountApi, AgeStanding } from "../../shared/net/auth";
import { Button } from "../../shared/ui/Button";
import { say } from "../../shared/words/text";

export function AgeScreen({ account, onStanding }: { account: AccountApi; onStanding: (standing: AgeStanding) => void }) {
  const [birth, setBirth] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function answer(event: FormEvent) {
    event.preventDefault();
    if (birth === "") {
      setProblem(say("ui.account.age.empty"));
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      onStanding(await account.declareAge(birth));
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
        <p className="text-muted">{say("ui.account.age.intro")}</p>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{say("ui.account.age.label")}</span>
        <input className="min-h-11 rounded-lg border border-line bg-surface px-3 text-base" type="date" autoComplete="bday" value={birth} onChange={(event) => setBirth(event.target.value)} />
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
    </form>
  );
}
