// The Blocked list (moderation:blocked-list-in-settings): every account the player blocked, newest first, each line a card
// as a board's line is (docs/design/09-the-games-look.md section 2): the face drawn from the shown name, the username,
// the day of the block and an Unblock button. An unblock that goes takes its line away; the list is read again each time
// the sheet opens. Loaded only when the sheet opens, so a first visit carries none of it (engine:first-download-has-budget).
import type { BlockedLine } from "@japacity/api";
import { useCallback, useEffect, useState } from "react";

import { lookForName } from "../front-door/looks";
import { FaceTile } from "../ui/look/FaceTile";
import { Loader } from "../ui/Loader";
import type { ModerationApi } from "./api";
import { words } from "./moderation.words";

type Asked = { state: "loading" } | { state: "listed"; lines: BlockedLine[] } | { state: "failed" };

// The player's own day of the block, as their phone's calendar says it.
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

function Line({ line, tilt, busy, onUnblock }: { line: BlockedLine; tilt: number; busy: boolean; onUnblock: () => void }) {
  // A gone account's line reads as a player until its rows go; its face is drawn from that shown name, as a board draws it.
  const name = line.username ?? words("ui.blocked.someone");
  return (
    <li className="look-card flex min-h-14 items-center gap-3 px-3 py-2" data-blocked-line>
      <FaceTile look={lookForName(name)} tilt={tilt} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[16px] font-bold" data-blocked-name>
          {name}
        </span>
        <span className="text-[13px] text-text-2" data-blocked-day>
          {words("ui.blocked.day", { day: DAY.format(line.at) })}
        </span>
      </span>
      <button type="button" className="phone-ghost shrink-0" disabled={busy} aria-label={words("ui.blocked.unblock", { name })} onClick={onUnblock}>
        {words("ui.block.undo")}
      </button>
    </li>
  );
}

export default function BlockedList({ moderation }: { moderation: ModerationApi }) {
  const [asked, setAsked] = useState<Asked>({ state: "loading" });
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [said, setSaid] = useState<"undone" | "failed" | null>(null);

  useEffect(() => {
    let live = true;
    setAsked({ state: "loading" });
    void moderation.blocked().then((reply) => {
      if (live) setAsked(reply.ok ? { state: "listed", lines: reply.blocked } : { state: "failed" });
    });
    return () => {
      live = false;
    };
  }, [moderation, round]);

  const unblock = useCallback(
    async (account: string): Promise<void> => {
      setBusy(account);
      setSaid(null);
      const reply = await moderation.unblock({ account });
      setBusy(null);
      if (!reply.ok) {
        setSaid("failed");
        return;
      }
      setSaid("undone");
      setAsked((now) => (now.state === "listed" ? { state: "listed", lines: now.lines.filter((line) => line.account !== account) } : now));
    },
    [moderation],
  );

  // The shared loader while the list is asked for (world:reach-and-read), never an empty sheet.
  if (asked.state === "loading") return <Loader label={words("ui.blocked.loading")} className="my-2" />;
  if (asked.state === "failed") {
    return (
      <div className="look-card flex flex-col items-start gap-2.5 p-3" data-blocked-failed>
        <p className="text-[15px] leading-snug">{words("ui.blocked.failed")}</p>
        <button type="button" className="phone-ghost" onClick={() => setRound((value) => value + 1)}>
          {words("ui.blocked.retry")}
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2.5" data-blocked-list>
      {said === "undone" ? (
        <p role="status" className="text-[14px] text-text-2">
          {words("ui.block.undone")}
        </p>
      ) : null}
      {said === "failed" ? (
        <p role="alert" className="text-[14px] text-bad">
          {words("ui.blocked.unblock.failed")}
        </p>
      ) : null}
      {asked.lines.length === 0 ? (
        <p className="look-card p-3 text-[15px] text-text-2">{words("ui.blocked.none")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {asked.lines.map((line, index) => (
            <Line key={line.account} line={line} tilt={index % 2 === 0 ? -4 : 4} busy={busy !== null} onUnblock={() => void unblock(line.account)} />
          ))}
        </ul>
      )}
    </div>
  );
}
