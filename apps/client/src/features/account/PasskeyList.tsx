// The passkeys of a saved life on its account sheet (account:passkeys-listed-and-removed): each one by its provider's
// name and the day it was added, with Remove, under their count, which is the list's own once it is read; adding one where the
// browser can make it, always with its line (account:passkey-offered-where-it-works); and the confirmation a session older
// than the server's fresh age needs before a passkey is added, made in place with a code or the account's own passkey
// (account:passkey-needs-signed-in-session). Removing any passkey asks once, in that passkey's own row, naming that phones
// signed in with it are signed out, and for the last one the way still left; Keep it is the main button, Remove it wears the
// warning colour apart from it (world:costly-acts-confirmed); the row then says it is removed, in the same place.
import type { AccountView } from "@japacity/api";
import { useEffect, useState, type HTMLAttributes } from "react";

import { useGame } from "../../authority/GameProvider";
import type { AccountApi, AuthResult, PasskeyRow } from "../../shared/net/auth";
import { Button } from "../../shared/ui/Button";
import { say, sayCount } from "../../shared/words/text";
import { CodeForm, failureWords } from "./CodeForm";
import { inAppBrowser } from "./inApp";
import { markPasskeyHere } from "./marks";
import { refreshAccount } from "./standing";
import { FocusLine, useShownWhole, useSteps } from "./steps";

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
interface Confirm {
  email: string | null;
  passkeyOnly?: true;
}

/** The sheet's step ids: the confirmation before a passkey is added, and the question before one is removed. */
const ADD = "passkey-add";
const REMOVE = "passkey-remove:";

export function PasskeyList({ account, ways }: { account: AccountApi; ways: AccountView["ways"] }) {
  const leave = useGame((state) => state.leave);
  const works = usePasskeysWork(account);
  const [rows, setRows] = useState<PasskeyRow[] | null>(null);
  // Each read of the list, counted: the list is read as the sheet opens and again after a passkey is added.
  const [reads, setReads] = useState(0);
  const [open, show] = useSteps();
  const [confirm, setConfirm] = useState<Confirm>({ email: null });
  // The passkeys removed while the sheet is open; the last one's row says so, in its own place.
  const [gone, setGone] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [rowProblem, setRowProblem] = useState<string | null>(null);

  // The list is read whatever the account last said it held: a passkey added or removed on another phone since then is listed as it is.
  useEffect(() => {
    let live = true;
    void account.passkeys().then((answer) => {
      if (live) setRows(answer);
    });
    return () => {
      live = false;
    };
  }, [account, reads]);

  const listed = rows === null ? null : rows.filter((row) => !gone.includes(row.id));
  // account:passkeys-listed-and-removed: the count is the list's own once the list is read, so the two never disagree.
  const held = listed === null ? ways.passkeys : listed.length;
  const removedLast = gone.at(-1) ?? null;

  async function run<T>(action: () => Promise<T>): Promise<T> {
    setBusy(true);
    setProblem(null);
    setRowProblem(null);
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
      show(null);
      // account:passkey-in-email-autofill: this browser has made one, so its ways back in put the passkey first.
      markPasskeyHere();
      setMessage(say("ui.account.passkey.added"));
      // The passkeys are read again, so the count and the list show the new one.
      setGone([]);
      setReads((count) => count + 1);
      void refreshAccount(account);
      return;
    }
    // An admin's session that has not shown a passkey lately is confirmed in place too, by the account's own passkey (account:passkey-added-in-place).
    if (result.why === "passkey-first" && held > 0) {
      setConfirm({ email: null, passkeyOnly: true });
      show(ADD);
      return;
    }
    if (result.why === "not-fresh") {
      setConfirm({ email: null });
      show(ADD);
      void account.email().then((email) => setConfirm((now) => (now.passkeyOnly === true ? now : { email })));
      return;
    }
    if (result.why === "cancelled") {
      if (confirmed) setMessage(say("ui.account.passkey.fresh.done"));
      return;
    }
    setProblem(failureWords(result));
  }

  const add = async () => {
    show(null);
    settleAdd(await run(() => account.addPasskey()), false);
  };

  /** The session is fresh again: the passkey is made at once. */
  const confirmed = async () => {
    show(null);
    settleAdd(await run(() => account.addPasskey()), true);
  };

  const confirmWithPasskey = async () => {
    const result = await run(() => account.confirmWithPasskey());
    if (result.ok) return confirmed();
    if (result.why !== "cancelled") setProblem(failureWords(result));
  };

  const remove = async (row: PasskeyRow) => {
    const result = await run(() => account.removePasskey(row.id));
    // A refusal stands in the question, which stays open; Keep it closes both.
    if (!result.ok) return setRowProblem(failureWords(result));
    // Removing a way in can end this phone's session with the rest (account:session-is-secure-cookie).
    if (!result.signedIn) return leave("ui.account.notice.signed-out");
    show(null);
    setGone((before) => [...before, row.id]);
    void refreshAccount(account);
  };

  const asked = (row: PasskeyRow) => {
    setRowProblem(null);
    setMessage(null);
    setProblem(null);
    show(`${REMOVE}${row.id}`);
  };

  return (
    <div className="flex flex-col gap-2" data-passkey-list>
      <p className="text-sm text-text-2" data-passkeys={held}>
        {sayCount("ui.account.passkeys", held, { count: held })}
      </p>
      {rows === null || rows.length === 0 ? null : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => {
            if (row.id === removedLast) {
              return (
                <li key={row.id} className="flex min-h-11 items-center rounded-lg border border-sheet-line px-3 py-2" data-passkey={row.id} data-passkey-removed>
                  <p role="status">{say("ui.account.passkey.removed")}</p>
                </li>
              );
            }
            if (gone.includes(row.id)) return null;
            const name = row.provider ?? say("ui.account.passkey.provider");
            const added = say("ui.account.passkey.added-on", { date: dayOf(row.addedAt) });
            const asking = open === `${REMOVE}${row.id}`;
            return (
              <li key={row.id} className="flex flex-col gap-2 rounded-lg border border-sheet-line px-3 py-2" data-passkey={row.id}>
                <div className="flex min-h-11 items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{name}</span>
                    <span className="block text-sm text-text-2">{added}</span>
                  </span>
                  {asking ? null : (
                    <Button small disabled={busy} aria-label={say("ui.account.passkey.remove.named", { name, date: dayOf(row.addedAt) })} onClick={() => asked(row)} data-step-opener={`${REMOVE}${row.id}`}>
                      {say("ui.account.passkey.remove")}
                    </Button>
                  )}
                </div>
                {asking ? (
                  <Shown className="motion-reveal flex flex-col gap-2 pb-1" role="group" data-passkey-ask>
                    <FocusLine>{say("ui.account.passkey.remove.ask", { name })}</FocusLine>
                    {held <= 1 ? <p>{lastWords(ways)}</p> : null}
                    <div>
                      <Button variant="primary" disabled={busy} onClick={() => show(null)}>
                        {say("ui.account.passkey.last.keep")}
                      </Button>
                    </div>
                    <div className="mt-1 border-t border-sheet-line pt-3">
                      <Button variant="warning" disabled={busy} onClick={() => void remove(row)}>
                        {say("ui.account.passkey.last.go")}
                      </Button>
                    </div>
                    {rowProblem === null ? null : (
                      <p role="alert" className="text-bad">
                        {rowProblem}
                      </p>
                    )}
                  </Shown>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {works !== true || open === ADD ? null : (
        <div className="flex flex-col gap-2">
          <div>
            <Button disabled={busy} onClick={() => void add()} data-step-opener={ADD}>
              {say("ui.account.passkey.add")}
            </Button>
          </div>
          <p className="text-sm text-text-2">{say("ui.account.passkey.why")}</p>
        </div>
      )}
      {open === ADD ? (
        <Shown className="motion-reveal flex flex-col gap-3" data-passkey-confirm>
          <FocusLine>{say("ui.account.passkey.fresh")}</FocusLine>
          {held > 0 ? (
            <div>
              <Button disabled={busy} onClick={() => void confirmWithPasskey()}>
                {say("ui.account.passkey.fresh.passkey")}
              </Button>
            </div>
          ) : null}
          {confirm.email === null ? null : (
            <CodeForm
              account={account}
              email={confirm.email}
              sendLabel={say("ui.account.passkey.fresh.code", { email: confirm.email })}
              goLabel={say("ui.account.passkey.fresh.code.go")}
              onSignedIn={() => void confirmed()}
            />
          )}
          <div>
            <Button variant="quiet" disabled={busy} onClick={() => show(null)}>
              {say("ui.account.passkey.later")}
            </Button>
          </div>
        </Shown>
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

/** A question asked in place, brought whole into view as it opens (steps.tsx). */
function Shown({ children, ...rest }: HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string | boolean | undefined>) {
  const group = useShownWhole<HTMLDivElement>();
  return (
    <div ref={group} {...rest}>
      {children}
    </div>
  );
}
