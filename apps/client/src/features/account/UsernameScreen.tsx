// The guest start (R-ACCOUNT-021, 013, 024): after the age screen, a username
// and the bot check, and the life starts at once. No email, no sign-in method:
// those come later, when the player wants to keep the life. A player who kept
// a life already goes to the ways back in instead.
import { useState, type FormEvent } from "react";

import type { AccountApi, GuestFailure } from "../../shared/net/auth";
import { Button } from "../../shared/ui/Button";
import { say } from "../../shared/words/text";
import type { LoadTurnstile } from "./Turnstile";
import { useUnseenCheck } from "./unseenCheck";

export interface UsernameScreenProps {
  account: AccountApi;
  sitekey: string | null;
  load: LoadTurnstile;
  onStarted: () => void;
  /** The age answer ran out: ask it again. */
  onExpired: () => void;
  /** Sign-ups closed meanwhile: the full screen. */
  onFull: () => void;
  onReturning: () => void;
}

const WORDS: Record<GuestFailure, string> = {
  format: "ui.account.name.format",
  reserved: "ui.account.name.reserved",
  blocked: "ui.account.name.blocked",
  taken: "ui.account.name.taken",
  wait: "ui.account.name.format",
  "bot-check": "ui.account.bot.failed",
  "too-many": "ui.account.guest.too-many",
  expired: "ui.account.guest.expired",
  "region-closed": "ui.account.region-closed",
  full: "ui.account.guest.full",
  unreachable: "ui.account.fail.unreachable",
  refused: "ui.account.fail.refused",
};

export function UsernameScreen({ account, sitekey, load, onStarted, onExpired, onFull, onReturning }: UsernameScreenProps) {
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const check = useUnseenCheck(sitekey, load);

  async function start(event: FormEvent) {
    event.preventDefault();
    const name = username.trim();
    if (name === "") {
      setProblem(say("ui.account.name.empty"));
      return;
    }
    setBusy(true);
    setProblem(null);
    const bot = await check.token();
    const answer = await account.startGuest(name, bot);
    setBusy(false);
    // A token is good once, whatever the server answered.
    if (bot !== null) check.spent();
    if (answer.ok) return onStarted();
    if (answer.why === "expired") return onExpired();
    if (answer.why === "full") return onFull();
    setProblem(say(WORDS[answer.why]));
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void start(event)} noValidate>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{say("ui.account.name.title")}</h1>
        <p className="text-muted">{say("ui.account.name.intro")}</p>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{say("ui.account.name.label")}</span>
        <input
          className="min-h-11 rounded-lg border border-line bg-surface px-3 text-base"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={20}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>
      <p className="-mt-3 text-sm text-muted">{say("ui.account.name.help")}</p>
      {check.widget}
      <div>
        <Button type="submit" variant="primary" disabled={busy}>
          {say("ui.account.name.go")}
        </Button>
      </div>
      {problem === null ? null : (
        <p role="alert" className="text-bad">
          {problem}
        </p>
      )}
      <div className="border-t border-line pt-4">
        <Button variant="quiet" onClick={onReturning}>
          {say("ui.account.returning")}
        </Button>
      </div>
    </form>
  );
}
