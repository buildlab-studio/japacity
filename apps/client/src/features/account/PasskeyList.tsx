// The passkeys of a kept life on its account sheet (account:passkeys-listed-and-removed): each one by its provider's
// name and the day it was added, with Remove; adding one where the browser can make it (account:passkey-offered-where-it-works),
// offered once on this device as a quiet line; and the confirmation a session older than the server's fresh age needs
// before a passkey is added, made in place with a code or the account's own passkey (account:passkey-needs-signed-in-session).
import type { AccountView } from "@japacity/api";
import { useEffect, useState } from "react";

import { useGame } from "../../authority/GameProvider";
import { browserStorage, PASSKEY_OFFERED_KEY } from "../../shared/storage/storage";
import type { AccountApi, AuthResult, PasskeyRow } from "../../shared/net/auth";
import { Button } from "../../shared/ui/Button";
import { say, sayCount } from "../../shared/words/text";
import { CodeForm, failureWords } from "./CodeForm";
import { inAppBrowser } from "./inApp";
import { markPasskeyHere } from "./marks";
import { refreshAccount } from "./standing";

/**
 * account:passkey-offered-where-it-works: whether a passkey can be made here; null while the browser is asked. Never inside an
 * in-app browser, whose passkeys would live in that app alone.
 */
export function usePasskeysWork(account: AccountApi): boolean | null {
  const [works, setWorks] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    const agent = typeof navigator === "undefined" ? "" : navigator.userAgent;
    if (inAppBrowser(agent)) {
      setWorks(false);
      return;
    }
    void account.passkeysWork().then((answer) => {
      if (live) setWorks(answer);
    });
    return () => {
      live = false;
    };
  }, [account]);
  return works;
}

/** account:passkey-offered-where-it-works: true the first time this device's sheet would offer a passkey, and marks it so it never offers again. */
function useOfferOnce(due: boolean): boolean {
  const [offer, setOffer] = useState(false);
  useEffect(() => {
    if (!due) return;
    const store = browserStorage();
    try {
      if (store !== null && store.getItem(PASSKEY_OFFERED_KEY) !== null) return;
      store?.setItem(PASSKEY_OFFERED_KEY, "1");
    } catch {
      // Storage that cannot be written cannot remember the offer either: it is made this once and never kept.
    }
    setOffer(true);
  }, [due]);
  return offer;
}

/** A day as the player reads it, in their own calendar. */
function dayOf(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

/** What removing the last passkey leaves, in words: Google where it is linked, else the code to the email. */
function lastWords(ways: AccountView["ways"]): string {
  if (ways.google !== null) return say("ui.account.passkey.last.google");
  return say("ui.account.passkey.last.email", { email: ways.email ?? "" });
}

/** `passkeyOnly`: the server asks for a session that has shown a passkey (an admin's, account:passkey-needs-signed-in-session), which a code does not open. */
type Step = { kind: "idle" } | { kind: "confirm"; email: string | null; passkeyOnly?: true } | { kind: "last"; row: PasskeyRow };

/** `known`: the account has been read, so `ways` is the server's and not a stand-in while it loads. */
export function PasskeyList({ account, ways, known }: { account: AccountApi; ways: AccountView["ways"]; known: boolean }) {
  const leave = useGame((state) => state.leave);
  const works = usePasskeysWork(account);
  const offer = useOfferOnce(known && works === true && ways.passkeys === 0);
  const [later, setLater] = useState(false);
  const [rows, setRows] = useState<PasskeyRow[] | null>(null);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const held = ways.passkeys;

  useEffect(() => {
    let live = true;
    if (held === 0) {
      setRows([]);
      return;
    }
    void account.passkeys().then((answer) => {
      if (live) setRows(answer);
    });
    return () => {
      live = false;
    };
  }, [account, held]);

  async function run<T>(action: () => Promise<T>): Promise<T> {
    setBusy(true);
    setProblem(null);
    setMessage(null);
    try {
      return await action();
    } finally {
      setBusy(false);
    }
  }

  /** A cancel is quiet; a confirmation that came before it asks for a tap to finish, as some phones want one for each passkey prompt. */
  function settleAdd(result: AuthResult, confirmed: boolean) {
    if (result.ok) {
      setStep({ kind: "idle" });
      // account:passkey-in-email-autofill: this browser has made one, so its ways back in put the passkey first.
      markPasskeyHere();
      setMessage(say("ui.account.passkey.added"));
      // The passkeys held are read again, so the count and the list show the new one.
      void refreshAccount(account);
      return;
    }
    // An admin's session that has not shown a passkey lately is confirmed in place too, by the account's own passkey (account:passkey-added-in-place).
    if (result.why === "passkey-first" && held > 0) {
      setStep({ kind: "confirm", email: null, passkeyOnly: true });
      return;
    }
    if (result.why === "not-fresh") {
      setStep({ kind: "confirm", email: null });
      void account.email().then((email) => setStep((now) => (now.kind === "confirm" ? { kind: "confirm", email } : now)));
      return;
    }
    if (result.why === "cancelled") {
      if (confirmed) setMessage(say("ui.account.passkey.fresh.done"));
      return;
    }
    setProblem(failureWords(result));
  }

  const add = async () => settleAdd(await run(() => account.addPasskey()), false);

  /** The session is fresh again: the passkey is made at once. */
  const confirmed = async () => {
    setStep({ kind: "idle" });
    settleAdd(await run(() => account.addPasskey()), true);
  };

  const confirmWithPasskey = async () => {
    const result = await run(() => account.confirmWithPasskey());
    if (result.ok) return confirmed();
    if (result.why !== "cancelled") setProblem(failureWords(result));
  };

  const remove = async (row: PasskeyRow) => {
    setStep({ kind: "idle" });
    const result = await run(() => account.removePasskey(row.id));
    if (!result.ok) return setProblem(failureWords(result));
    // Removing a way in can end this phone's session with the rest (account:session-is-secure-cookie).
    if (!result.signedIn) return leave("ui.account.notice.signed-out");
    setMessage(say("ui.account.passkey.removed"));
    void refreshAccount(account);
  };

  const asked = (row: PasskeyRow) => (held <= 1 ? setStep({ kind: "last", row }) : void remove(row));
  const offering = offer && !later && held === 0;

  return (
    <div className="flex flex-col gap-2" data-passkey-list>
      <p className="text-sm text-text-2" data-passkeys={held}>
        {sayCount("ui.account.passkeys", held, { count: held })}
      </p>
      {rows === null || rows.length === 0 ? null : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => {
            const name = row.provider ?? say("ui.account.passkey.provider");
            const added = say("ui.account.passkey.added-on", { date: dayOf(row.addedAt) });
            return (
              <li key={row.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-sheet-line px-3 py-2" data-passkey={row.id}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{name}</span>
                  <span className="block text-sm text-text-2">{added}</span>
                </span>
                <Button small disabled={busy} aria-label={say("ui.account.passkey.remove.named", { name, date: dayOf(row.addedAt) })} onClick={() => asked(row)}>
                  {say("ui.account.passkey.remove")}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {step.kind === "last" ? (
        <div className="motion-reveal flex flex-col gap-2" role="group">
          <p>{lastWords(ways)}</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void remove(step.row)}>
              {say("ui.account.passkey.last.go")}
            </Button>
            <Button disabled={busy} onClick={() => setStep({ kind: "idle" })}>
              {say("ui.account.passkey.last.keep")}
            </Button>
          </div>
        </div>
      ) : null}
      {works !== true || step.kind === "confirm" ? null : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-2">{say(offering ? "ui.account.passkey.offer" : "ui.account.passkey.why")}</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void add()}>
              {say("ui.account.passkey.add")}
            </Button>
            {offering ? (
              <Button variant="quiet" disabled={busy} onClick={() => setLater(true)}>
                {say("ui.account.passkey.later")}
              </Button>
            ) : null}
          </div>
        </div>
      )}
      {step.kind === "confirm" ? (
        <div className="motion-reveal flex flex-col gap-3" data-passkey-confirm>
          <p>{say("ui.account.passkey.fresh")}</p>
          {held > 0 ? (
            <div>
              <Button disabled={busy} onClick={() => void confirmWithPasskey()}>
                {say("ui.account.passkey.fresh.passkey")}
              </Button>
            </div>
          ) : null}
          {step.email === null ? null : (
            <CodeForm
              account={account}
              email={step.email}
              sendLabel={say("ui.account.passkey.fresh.code", { email: step.email })}
              goLabel={say("ui.account.passkey.fresh.code.go")}
              onSignedIn={() => void confirmed()}
            />
          )}
          <div>
            <Button variant="quiet" disabled={busy} onClick={() => setStep({ kind: "idle" })}>
              {say("ui.account.passkey.later")}
            </Button>
          </div>
        </div>
      ) : null}
      {message === null ? null : <p role="status">{message}</p>}
      {problem === null ? null : (
        <p role="alert" className="text-bad">
          {problem}
        </p>
      )}
    </div>
  );
}
