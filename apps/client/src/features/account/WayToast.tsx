// The one short line a way in leaves over the world (account:guest-secures-the-life): "Saved with
// Google" once a guest's life is saved, "Signed in with your email" once a kept life is signed back in to. The sign-in
// sheet closes as the life opens, so its welcome is handed here and told once the world is up; the keeping sheet hands
// its line here as it closes. One store for each account seam, as standing.ts keeps the account. The line is read out
// through one polite live region, mounted with the world before any line comes; the toast itself is for the eye. The
// region is polite by its `status` role alone: an `aria-live` attribute would keep it out of what an open sheet hides,
// so the sheet's hiding would reach down past the shell to each part of the world, the band among them. Once a line other
// than a passkey's has been told, the card that offers a passkey follows it (account:passkey-offered-where-it-works), fetched
// then with the account sheet's code and words, so a first visit carries none of it (engine:first-download-has-budget).
import { ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

import type { AccountApi } from "../../shared/net/auth";
import { say } from "../../shared/words/text";
import { SAID_TOAST_MS } from "../../shared/world/SaidToast";
import { loadAccountSheet, type AccountSheet } from "./AccountButton";

/**
 * What was done and by which way: each names its line in the words (`ui.account.toast.<way>`). `taken.email`: a new life whose
 * proved address an account took meanwhile started as a guest (account:guest-secures-the-life).
 */
export type Way = "kept.google" | "kept.email" | "in.google" | "in.email" | "in.passkey" | "taken.email";

/** The lines no passkey's card follows: a passkey's own way in, and a life that is still a guest's. */
const NO_CARD: ReadonlySet<Way> = new Set(["in.passkey", "taken.email"]);

interface Held {
  told: { way: Way; at: number } | null;
  /** A line told and gone that a passkey's card may follow: any way but a passkey's own. */
  after: boolean;
}

const stores = new WeakMap<AccountApi, StoreApi<Held>>();

function storeOf(account: AccountApi): StoreApi<Held> {
  const kept = stores.get(account);
  if (kept !== undefined) return kept;
  const made = createStore<Held>(() => ({ told: null, after: false }));
  stores.set(account, made);
  return made;
}

/** Hands the line to the world, to be told once it is up. */
export function tellWay(account: AccountApi, way: Way): void {
  storeOf(account).setState({ told: { way, at: Date.now() } });
}

type Card = AccountSheet["PasskeyCard"];

/** The card rides the account sheet's chunk with its words, fetched once a line it may follow has been told. */
const loadCard = (): Promise<Card> => loadAccountSheet().then((sheet) => sheet.PasskeyCard);

/** The line, under the top of the screen for a few seconds and gone; under any sheet that is open, never over it. */
export function WayToast({ account }: { account: AccountApi }) {
  const store = storeOf(account);
  const told = useStore(store, (held) => held.told);
  const shown = useRef(store);
  shown.current = store;
  const after = useStore(store, (held) => held.after);
  const [Card, setCard] = useState<{ Card: Card } | null>(null);
  useEffect(() => {
    if (told === null) return;
    const timer = window.setTimeout(() => shown.current.setState({ told: null, after: !NO_CARD.has(told.way) }), SAID_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [told]);
  useEffect(() => {
    if (!after || Card !== null) return;
    let live = true;
    loadCard().then(
      (loaded) => {
        if (live) setCard({ Card: loaded });
      },
      // A card that cannot be fetched is simply not offered.
      () => shown.current.setState({ after: false }),
    );
    return () => {
      live = false;
    };
  }, [after, Card]);
  return (
    <>
      <p role="status" className="sr-only" data-way-said>
        {told === null ? "" : say(`ui.account.toast.${told.way}`)}
      </p>
      {told === null ? null : (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center px-4 pt-[calc(max(10px,env(safe-area-inset-top))+64px)]" aria-hidden>
          <p key={told.at} className="brief-toast slide-in flex items-center gap-2 px-4 py-2.5 text-[16px] leading-snug font-bold" data-way-toast={told.way}>
            {told.way === "taken.email" ? null : <ShieldCheck size={20} aria-hidden className="shrink-0" />}
            {say(`ui.account.toast.${told.way}`)}
          </p>
        </div>
      )}
      {after && Card !== null ? <Card.Card account={account} onDone={() => shown.current.setState({ after: false })} /> : null}
    </>
  );
}
