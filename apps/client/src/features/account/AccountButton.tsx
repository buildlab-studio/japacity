// The account's row at the head of the phone's Settings (account:username-and-unconfirmed-email, account:guest-reminded-to-secure): the
// name's initial, the name, the username and the way the life is kept, the whole row one tap. The sheet it opens rides chunks of
// its own, its code (Settings.tsx) and its words (through shared/words/later.ts) (engine:first-download-has-budget): both fetched as the row
// shows, and the sheet opened only once both are in, so it never shows a key or an empty line.
import type { AccountView } from "@japacity/api";
import { ChevronRight } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { useGame } from "../../authority/GameProvider";
import { counting } from "../../shared/analytics/start";
import { pageOf } from "../../shared/datapage/PageSheet";
import { Sheet } from "../../shared/ui/Sheet";
import { say } from "../../shared/words/text";
import { loadLaterWords } from "../../shared/words/later";
import { useAccountView } from "./standing";

/** A guest's ways back in: none but its own session (account:guest-and-secured-states). */
export const NO_WAYS: AccountView["ways"] = { google: null, email: null, passkeys: 0 };

/** The account's ways back in; none from a server older than `ways`. */
export function waysOf(view: AccountView): AccountView["ways"] {
  return (view as Partial<AccountView>).ways ?? NO_WAYS;
}

/**
 * The way the life is kept, in one line (account:guest-secures-the-life, account:guest-reminded-to-secure): Google by its address where Google is linked, else the
 * email. `full`: the email's address too, as the sheet says it; the row says it short. A guest's life is on this phone.
 */
export function keptLine(view: AccountView, full: boolean): string {
  if (view.state === "guest") return say("ui.account.ways.guest");
  const { google, email } = waysOf(view);
  if (google !== null) return say("ui.account.ways.google", { email: google });
  if (email === null) return "";
  return full ? say("ui.account.ways.email", { email }) : say("ui.account.ways.email.short");
}

/** The character's name as given at the door, or "" while there is none. */
export function useLifeName(): string {
  const view = useGame((state) => state.view);
  return view === null ? "" : pageOf(view).name;
}

type AccountSheet = typeof import("./Settings");

/** The sheet's code and its words, each fetched once. */
export function loadAccountSheet(): Promise<AccountSheet> {
  return Promise.all([import("./Settings"), loadLaterWords("sheet")]).then(([sheet]) => sheet);
}

/**
 * The way into the account from the phone's Settings: one row in the phone's dress, the whole of it the tap. The name's
 * initial in a round mark, the name and the username on two lines, the way the life is kept under them, and a chevron.
 * Nothing offline, so the phone's Settings shows no empty account then. `more`: another feature's
 * settings, placed by the shell.
 */
export function AccountButton({ more = null }: { more?: ReactNode }) {
  const account = useGame((state) => state.account);
  const me = useAccountView();
  const name = useLifeName();
  const [sheet, setSheet] = useState<AccountSheet | null>(null);
  const [open, setOpen] = useState(false);
  // Fetched as the row shows, so a tap opens the sheet at once.
  useEffect(() => {
    if (account === null) return undefined;
    let live = true;
    loadAccountSheet().then(
      (loaded) => {
        if (live) setSheet(loaded);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [account]);
  if (account === null) return null;
  const username = me === null ? "" : say("ui.account.name.current", { name: me.username });
  const initial = (name === "" ? (me?.username ?? "") : name).charAt(0).toUpperCase();
  const Settings = sheet?.AccountSettings ?? null;
  return (
    <>
      <button
        type="button"
        className="lively-card press mt-1 mb-3 flex w-full items-center gap-3 p-3 text-left"
        onClick={() => {
          counting().count("screen/opened", "settings");
          loadAccountSheet().then(
            (loaded) => {
              setSheet(loaded);
              setOpen(true);
            },
            () => undefined,
          );
        }}
        data-account-row
      >
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-action text-[20px] font-bold text-action-text">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          {name === "" ? null : <span className="block truncate text-[17px] font-bold">{name}</span>}
          <span className={`block truncate ${name === "" ? "text-[17px] font-bold" : "text-[14px] text-text-2"}`}>{username === "" ? say("ui.account.settings") : username}</span>
          {me === null ? null : <span className="block text-[13px] leading-snug text-text-2">{keptLine(me, false)}</span>}
        </span>
        <ChevronRight size={20} className="shrink-0" aria-hidden />
      </button>
      <Sheet open={open && Settings !== null} onOpenChange={setOpen} title={say("ui.account.settings")}>
        {Settings === null ? null : <Settings account={account} more={more} />}
      </Sheet>
    </>
  );
}
